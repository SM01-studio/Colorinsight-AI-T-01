// We declare the global pdfjsLib variable which is loaded via CDN in index.html
declare const pdfjsLib: any;

export const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 20); // Limit to 20 pages for demo performance

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `[Page ${i}] ${pageText}\n`;
    }

    return fullText;
  } catch (error) {
    console.error("Error extracting PDF text:", error);
    throw new Error("Failed to parse PDF file. Please ensure it is a valid PDF.");
  }
};