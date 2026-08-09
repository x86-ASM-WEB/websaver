from workers import Response, WorkerEntrypoint
import json















class Default(WorkerEntrypoint):
    async def fetch(self, request):
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

                # Get binary image buffer from uploaded photo
                image_bytes = await photo.arrayBuffer()

                # 1. Run Image-to-Text OCR using Cloudflare Workers AI
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

                # 2. Format as simple text file contents (e.g., name.txt)
                text_filename = f"{doc_name}.txt"

                return Response(
                    json.dumps({
                        "success": True,
                        "filename": text_filename,
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