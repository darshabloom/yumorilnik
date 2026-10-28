/**
 * Harmless PDF attachment for the organiser-only confirmation email test.
 * The QR encodes YUMORILNIK-TEST-QR-NOT-A-VALID-TICKET-2026.
 * Never use this module to issue customer admissions or validate check-in.
 * A live ticket needs a separately reviewed, server-verified credential.
 */
const TEST_QR = `
0000000000000000000000000000000000000
0000000000000000000000000000000000000
0011111110100110101101000110111111100
0010000010111011011001010110100000100
0010111010010000011100100010101110100
0010111010110001110101001100101110100
0010111010111011110000101000101110100
0010000010111100001101101100100000100
0011111110101010101010101010111111100
0000000000000100101010010010000000000
0000010010011101110001011010011101100
0011111001011001001101010010110001000
0000110010110000100011100001010010100
0011100001001100101100111101001001000
0010011010001111010101101001001100000
0000110001110100100111000101011100100
0001110110001011001100110101101101000
0010010001011000010011000100110010000
0011111010110000101001111111010110100
0000010100111100111100000011001001100
0000100111011011001111101011001110000
0000101100110001000010100010100110000
0011110011001100110001010001101110000
0000010100011000010111011101000110000
0011100111000101011010001000110000100
0001010100110011011101111001110010000
0010110011100001100001000011111001000
0000000000111000100011100010001110000
0011111110000100001000110010101101000
0010000010010000001000000110001011100
0010111010010111100011101011111001000
0010111010111101001010000100111000100
0010111010010010110110000001110010100
0010000010010101000001100001100000100
0011111110000000111101011100111100000
0000000000000000000000000000000000000
0000000000000000000000000000000000000
`.trim().split("\n");

function pdfLiteral(value: string) {
  // This sample uses PDF base Helvetica, which supports ASCII labels only.
  return value.replace(/[\\()]/g, "\\$&");
}

/** Small dependency-free PDF so the email preview works without new packages. */
export function sampleQrTicketPdf(): Buffer {
  const draw: string[] = [
    "0.996 0.970 0.930 rg 0 0 720 440 re f",
    "0.972 0.629 0.282 rg 22 22 676 396 re f",
    "1 1 1 rg 34 34 652 372 re f",
    "0.996 0.741 0.067 rg 625 350 28 28 re f",
    "0.855 0.263 0.188 rg 658 322 15 15 re f",
  ];
  function label(text: string, x: number, y: number, font: "F1" | "F2", size: number, colour: string) {
    draw.push(`${colour} rg BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfLiteral(text)}) Tj ET`);
  }
  label("YUMORILNIK", 54, 348, "F2", 31, "0.11 0.11 0.11");
  label("EVENT TICKET PREVIEW", 56, 325, "F1", 12, "0.18 0.18 0.18");
  draw.push("0.87 0.76 0.68 RG 1 w 55 308 m 664 308 l S");
  label("NOVOGODNIK 2026", 56, 273, "F2", 22, "0.12 0.12 0.12");
  label("New Year celebration - Sample booking", 56, 250, "F1", 12, "0.20 0.20 0.20");
  label("GUEST / SAMPLE", 56, 212, "F2", 11, "0.12 0.12 0.12");
  label("Sample Guest", 56, 192, "F1", 13, "0.20 0.20 0.20");
  label("BOOKING REFERENCE", 56, 156, "F2", 11, "0.12 0.12 0.12");
  label("TEST-YMR-EXAMPLE", 56, 136, "F1", 13, "0.20 0.20 0.20");
  label("NOT VALID FOR ADMISSION", 55, 85, "F2", 19, "0.70 0.14 0.10");
  label("Design and email-delivery test only. No ticket was issued.", 56, 63, "F1", 10, "0.65 0.18 0.11");

  const moduleSize = 4.75;
  const x0 = 472, y0 = 106;
  draw.push(`1 1 1 rg ${x0 - 12} ${y0 - 12} ${TEST_QR.length * moduleSize + 24} ${TEST_QR.length * moduleSize + 30} re f`);
  draw.push("0 0 0 rg");
  for (let row = 0; row < TEST_QR.length; row++) {
    for (let col = 0; col < TEST_QR[row].length; col++) {
      if (TEST_QR[row][col] === "1") {
        draw.push(`${(x0 + col * moduleSize).toFixed(2)} ${(y0 + (TEST_QR.length - row - 1) * moduleSize).toFixed(2)} ${moduleSize} ${moduleSize} re f`);
      }
    }
  }
  label("TEST QR ONLY", 512, 91, "F2", 9, "0.20 0.20 0.20");

  const stream = draw.join("\n") + "\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 720 440] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}
