from workers import Response, WorkerEntrypoint
import json








def create_basic_pdf_bytes(title: str, text: str) -> bytes:
    """Generates a minimal valid PDF byte string."""
    content = f"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj 2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj 3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj 4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj 5 0 obj << /Length {len(text) + 50} >> stream BT /F1 16 Tf 50 750 Td ({title}) Tj 0 -30 Td /F1 12 Tf ({text[:200]}) Tj ET endstream endobj"
    pdf_str = f"%PDF-1.4\n{content}\nxref\n0 6\n0000000000 65535 f \ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n%%EOF"
    return pdf_str.encode("utf-8")


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        # Handle POST request to /api/upload
        if request.method == "POST" and request.url.endswith("/api/upload"):
            try:
                form_data = await request.formData()
                photo = form_data.get("photo")
                doc_name = form_data.get("doc_name") or "untitled"

                if not photo:
                    return Response(
                        json.dumps({"error": "No photo uploaded"}), 
                        status=400,
                        headers={"Content-Type": "application/json"}
                    )

                # Get binary image buffer
                image_bytes = await photo.arrayBuffer()

                # 1. Image-to-Text OCR via Cloudflare Workers AI
                extracted_text = "No text extracted."
                if hasattr(self.env, "AI"):
                    ai_response = await self.env.AI.run(
                        "@cf/meta/llama-3.2-11b-vision-instruct",
                        {
                            "image": list(image_bytes),
                            "prompt": "Extract all readable text from this image exactly as written."
                        }
                    )
                    extracted_text = ai_response.get("response", "No text found.")

                clean_text = extracted_text.replace("\n", " ")

                # 2. Save PNG, TXT, and PDF to R2 Storage under <doc_name>/
                if hasattr(self.env, "DOCS_BUCKET"):
                    # Save PNG file
                    await self.env.DOCS_BUCKET.put(
                        f"{doc_name}/{doc_name}.png", 
                        image_bytes, 
                        {"httpMetadata": {"contentType": "image/png"}}
                    )

                    # Save TXT file
                    await self.env.DOCS_BUCKET.put(
                        f"{doc_name}/{doc_name}.txt", 
                        extracted_text, 
                        {"httpMetadata": {"contentType": "text/plain"}}
                    )

                    # Save PDF file
                    pdf_bytes = create_basic_pdf_bytes(doc_name, clean_text)
                    await self.env.DOCS_BUCKET.put(
                        f"{doc_name}/{doc_name}.pdf", 
                        pdf_bytes, 
                        {"httpMetadata": {"contentType": "application/pdf"}}
                    )

                # Respond back to website
                return Response(
                    json.dumps({
                        "success": True,
                        "directory": f"{doc_name}/",
                        "files": [f"{doc_name}.png", f"{doc_name}.txt", f"{doc_name}.pdf"],
                        "extracted_text": extracted_text
                    }),
                    status=200,
                    headers={"Content-Type": "application/json"}
                )

            except Exception as err:
                return Response(
                    json.dumps({"error": str(err)}), 
                    status=500,
                    headers={"Content-Type": "application/json"}
                )

        return Response("Websaver API Running", status=200)