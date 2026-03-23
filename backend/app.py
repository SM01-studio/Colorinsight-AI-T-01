"""
ColorInsight AI Backend
Flask application for ColorInsight color strategy analysis

Deploy: api.siliang.cfd/api/colorinsight/
"""

import os
import json
import re
from functools import wraps
from pathlib import Path
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

# Load .env file for local development
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    load_dotenv(env_path)
    print(f"[INFO] Loaded .env from {env_path}")
except ImportError:
    print("[INFO] python-dotenv not installed, using system environment")

app = Flask(__name__)
CORS(app, origins=['https://colorinsight.siliang.cfd', 'http://localhost:3000'])

# Configuration - All values must be set via environment variables
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
IMAGE_API_KEY = os.environ.get('IMAGE_API_KEY')
IMAGE_API_ENDPOINT = os.environ.get('IMAGE_API_ENDPOINT', 'https://api.apicore.ai/v1/chat/completions')
IMAGE_MODEL = os.environ.get('IMAGE_MODEL', 'gemini-3-pro-image-preview-4k')
MAIN_PORTAL_API = os.environ.get('MAIN_PORTAL_API', 'https://api.siliang.cfd')

# Validate required configuration
if not GEMINI_API_KEY:
    print("[WARN] GEMINI_API_KEY not set - text analysis will fail")
if not IMAGE_API_KEY:
    print("[WARN] IMAGE_API_KEY not set - image generation will fail")

# Gemini API configuration
GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'


# ============ Authentication Middleware ============

# Check if in development mode
DEV_MODE = os.environ.get('DEV_MODE', 'false').lower() == 'true'

def verify_token_with_portal(token: str) -> dict:
    """Verify token with main portal API"""
    try:
        response = requests.get(
            f"{MAIN_PORTAL_API}/api/auth/me",
            headers={'Authorization': f'Bearer {token}'},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        app.logger.error(f"Token verification failed: {e}")
        return None

def require_auth(f):
    """Authentication decorator - verifies token with main portal"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401

        token = auth_header.replace('Bearer ', '')

        # Development mode: accept dev-token
        if DEV_MODE and token == 'dev-token':
            request.user = {'id': 1, 'username': 'dev-user'}
            return f(*args, **kwargs)

        # Verify token with main portal
        user_data = verify_token_with_portal(token)
        if not user_data:
            return jsonify({'error': 'Invalid or expired token'}), 401

        request.user = user_data.get('user', {})
        return f(*args, **kwargs)
    return decorated_function


# ============ Helper Functions ============

def call_gemini_api(model: str, prompt: str, response_schema: dict = None, use_search: bool = False):
    """Call Gemini API with optional JSON schema and Google Search"""
    url = f"{GEMINI_ENDPOINT}/{model}:generateContent?key={GEMINI_API_KEY}"

    headers = {'Content-Type': 'application/json'}

    body = {
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {}
    }

    if response_schema and not use_search:
        body['generationConfig']['responseMimeType'] = 'application/json'
        body['generationConfig']['responseSchema'] = response_schema

    if use_search:
        body['tools'] = [{'googleSearch': {}}]

    try:
        response = requests.post(url, headers=headers, json=body, timeout=120)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Gemini API error: {e}")
        raise Exception(f"Gemini API call failed: {str(e)}")


def extract_text_from_response(response: dict) -> str:
    """Extract text from Gemini API response"""
    try:
        return response['candidates'][0]['content']['parts'][0]['text']
    except (KeyError, IndexError):
        return ''


def extract_sources_from_response(response: dict) -> list:
    """Extract grounding sources from Gemini API response"""
    sources = []
    try:
        chunks = response['candidates'][0]['groundingMetadata']['groundingChunks']
        for chunk in chunks:
            if 'web' in chunk and chunk['web'].get('uri'):
                sources.append({
                    'title': chunk['web'].get('title', ''),
                    'url': chunk['web']['uri']
                })
    except (KeyError, IndexError, TypeError):
        pass

    # Deduplicate
    seen = set()
    unique = []
    for s in sources:
        if s['url'] not in seen:
            seen.add(s['url'])
            unique.append(s)
    return unique[:5]


# ============ API Routes ============

@app.route('/sessions', methods=['GET'])
@app.route('/api/colorinsight/sessions', methods=['GET'])
@require_auth
def get_sessions():
    """Session info endpoint"""
    return jsonify({
        'active': True,
        'user': request.user,
    })


@app.route('/api/colorinsight/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'colorinsight'})


@app.route('/api/colorinsight/extract-requirements', methods=['POST'])
@require_auth
def extract_requirements():
    """Extract color requirements from PDF text"""
    data = request.get_json()

    if not data or 'pdfText' not in data:
        return jsonify({'error': 'Missing pdfText in request body'}), 400

    pdf_text = data['pdfText'][:15000]  # Limit text length

    prompt = f"""
    You are a professional color consultant. Analyze the following PDF text from a client positioning report.

    Tasks:
    1. Identify the Customer Name or Brand Name.
    2. Extract key requirements related to color, atmosphere, target audience, and design preferences.

    Input Text:
    {pdf_text}...

    Output JSON format:
    {{
      "customerName": "String",
      "requirements": [
        {{ "id": "1", "text": "Detailed requirement description in Chinese (Original text)", "summaryEn": "English summary", "sourcePage": 1 }}
      ]
    }}
    """

    schema = {
        "type": "object",
        "properties": {
            "customerName": {"type": "string"},
            "requirements": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "text": {"type": "string"},
                        "summaryEn": {"type": "string"},
                        "sourcePage": {"type": "integer"}
                    }
                }
            }
        }
    }

    try:
        response = call_gemini_api('gemini-2.5-flash', prompt, schema)
        text = extract_text_from_response(response)
        result = json.loads(text)
        return jsonify(result)
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Failed to parse AI response: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/colorinsight/market-search', methods=['POST'])
@require_auth
def market_search():
    """Perform market research using Google Search"""
    data = request.get_json()

    if not data or 'requirements' not in data:
        return jsonify({'error': 'Missing requirements in request body'}), 400

    requirements = data['requirements']
    req_text = '; '.join([f"{r.get('text', '')} ({r.get('summaryEn', '')})" for r in requirements])

    prompt = f"""
    Based on the client's color requirements: "{req_text}"

    Use Google Search to find REAL, GLOBAL data. Focus on International/Western design trends (Europe, North America, Japan) and Global Color Forecasts.

    1. Search for "2024 2025 Interior Design Color Trends", "Pantone Fashion Color Trend Report", or "Global Color Forecast".
    2. Search for real competitor projects or similar high-end design case studies globally.

    Strictly output VALID JSON string only. No introductory text.
    JSON Structure:
    {{
      "trends": [{{ "en": "Trend Name", "zh": "Chinese Translation" }}],
      "competitors": [{{ "en": "Project Name", "zh": "Chinese Translation" }}],
      "keywords": ["keyword1", "keyword2"],
      "marketInsight": {{ "en": "English insight paragraph...", "zh": "Chinese translation..." }}
    }}
    """

    try:
        response = call_gemini_api('gemini-2.5-flash', prompt, use_search=True)
        text = extract_text_from_response(response)

        # Clean markdown if present
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text).strip()

        result = json.loads(text)

        # Add sources
        sources = extract_sources_from_response(response)
        result['sources'] = sources

        return jsonify(result)
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Failed to parse search results: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/colorinsight/generate-schemes', methods=['POST'])
@require_auth
def generate_schemes():
    """Generate and score color schemes"""
    data = request.get_json()

    if not data or 'requirements' not in data or 'searchData' not in data:
        return jsonify({'error': 'Missing requirements or searchData in request body'}), 400

    requirements = data['requirements']
    search_data = data['searchData']

    req_text = '; '.join([r.get('text', '') for r in requirements])
    market_context = json.dumps(search_data, ensure_ascii=False)

    prompt = f"""
    Role: World-class Color Strategy Expert.
    Context: Client Requirements: "{req_text}". Market Research: {market_context}

    Task: Create 4 distinct, high-end color schemes.
    1. "Global Trend" (Based on search trends)
    2. "Market Safe" (Conservative, luxurious)
    3. "Bold Innovation" (Avant-garde)
    4. "Balanced Classic" (Timeless)

    For each scheme:
    - Provide 3 HEX colors.
    - Score 0-10 on Match, Trend, Market, Innovation, Harmony.
    - Provide SWOT analysis (Strengths/Weaknesses) in BOTH English and Chinese.
    - Usage Advice in BOTH English and Chinese.
    """

    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "name": {
                    "type": "object",
                    "properties": {
                        "en": {"type": "string"},
                        "zh": {"type": "string"}
                    }
                },
                "description": {
                    "type": "object",
                    "properties": {
                        "en": {"type": "string"},
                        "zh": {"type": "string"}
                    }
                },
                "palette": {
                    "type": "object",
                    "properties": {
                        "primary": {"type": "string"},
                        "secondary": {"type": "string"},
                        "accent": {"type": "string"}
                    }
                },
                "scores": {
                    "type": "object",
                    "properties": {
                        "match": {"type": "number"},
                        "trend": {"type": "number"},
                        "market": {"type": "number"},
                        "innovation": {"type": "number"},
                        "harmony": {"type": "number"}
                    }
                },
                "sources": {"type": "array", "items": {"type": "string"}},
                "usageAdvice": {
                    "type": "object",
                    "properties": {
                        "en": {"type": "string"},
                        "zh": {"type": "string"}
                    }
                },
                "swot": {
                    "type": "object",
                    "properties": {
                        "strengths": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "en": {"type": "string"},
                                    "zh": {"type": "string"}
                                }
                            }
                        },
                        "weaknesses": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "en": {"type": "string"},
                                    "zh": {"type": "string"}
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    try:
        response = call_gemini_api('gemini-2.5-flash', prompt, schema)
        text = extract_text_from_response(response)
        schemes = json.loads(text)

        # Calculate weighted scores
        for scheme in schemes:
            scores = scheme.get('scores', {})
            scheme['weightedScore'] = round(
                scores.get('match', 0) * 0.30 +
                scores.get('trend', 0) * 0.25 +
                scores.get('market', 0) * 0.20 +
                scores.get('innovation', 0) * 0.15 +
                scores.get('harmony', 0) * 0.10,
                2
            )

        return jsonify(schemes)
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Failed to parse schemes: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/colorinsight/generate-image', methods=['POST'])
@require_auth
def generate_image():
    """Generate visualization image using apicore.ai"""
    data = request.get_json()

    if not data or 'scheme' not in data:
        return jsonify({'error': 'Missing scheme in request body'}), 400

    scheme = data['scheme']
    requirements = data.get('requirements', [])

    context = '; '.join([
        r.get('summaryEn') or r.get('text', '')
        for r in requirements[:3]
    ])

    prompt = f"""Generate a photorealistic, high-end architectural interior photography.

Subject: {context}
Style: Architectural Digest, Vogue Living, soft natural lighting, ultra-detailed, 8k.

Color Palette to Apply:
- Dominant: {scheme['palette']['primary']}
- Secondary: {scheme['palette']['secondary']}
- Accent: {scheme['palette']['accent']}

Composition: Wide angle, cinematic, minimalist, luxury.
NO text, NO labels. high quality, detailed, 4K"""

    try:
        headers = {
            'Authorization': f'Bearer {IMAGE_API_KEY}',
            'Content-Type': 'application/json'
        }

        payload = {
            'model': IMAGE_MODEL,
            'stream': False,
            'messages': [{'role': 'user', 'content': prompt}]
        }

        response = requests.post(
            IMAGE_API_ENDPOINT,
            headers=headers,
            json=payload,
            timeout=300
        )
        response.raise_for_status()
        result = response.json()

        # Extract image from response
        image_data = None
        image_url = None

        if 'choices' in result and len(result['choices']) > 0:
            choice = result['choices'][0]
            message = choice.get('message', {})
            content = message.get('content', '')

            if isinstance(content, str):
                # Markdown format: ![Image](url)
                md_match = re.search(r'!\[.*?\]\((https?://[^\s\)]+)\)', content)
                if md_match:
                    image_url = md_match.group(1)

                # Direct URL
                elif content.startswith('http') and re.search(r'\.(jpg|jpeg|png|gif|webp)', content, re.I):
                    image_url = content

                # base64 format
                elif content.startswith('data:image'):
                    return jsonify({'image': content})

                # Try to extract URL from text
                else:
                    url_match = re.search(r'(https?://[^\s\)]+(?:jpg|jpeg|png|gif|webp))', content, re.I)
                    if url_match:
                        image_url = url_match.group(1)

            # content is array
            elif isinstance(content, list):
                for item in content:
                    if item.get('type') == 'image_url':
                        image_url = item.get('image_url', {}).get('url')
                        break

        if image_url:
            # Fetch image and convert to base64
            img_response = requests.get(image_url, timeout=30)
            img_response.raise_for_status()

            import io
            from base64 import b64encode

            # Detect content type
            content_type = img_response.headers.get('Content-Type', 'image/jpeg')
            b64_data = b64encode(img_response.content).decode('utf-8')

            return jsonify({
                'image': f'data:{content_type};base64,{b64_data}'
            })

        return jsonify({'error': 'No image found in API response', 'response': result}), 500

    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Image API error: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ============ Error Handlers ============

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Not found'}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)
