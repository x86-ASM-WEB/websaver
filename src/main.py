from workers import Response, WorkerEntrypoint
import json
















class Default(WorkerEntrypoint):
    async def fetch(self, request):
        if request.method == "POST" and request.url.endswith("/api/upload"):
            try:
                # 1. Parse multipart form data from request
                # In Pyodide/Cloudflare Workers Python runtime, request.formData() is an async call
                form_data = await request.formData()
                
                photo = form_data.get("photo")
                doc_name = form_data.get("doc_name") or "untitled"

                if not photo:
                    return Response(
                        json.dumps({"error": "No photo file provided in request"}), 
                        status=400,
                        headers={"Content-Type": "application/json"}
                    )

                # 2. Extract binary array buffer from file object
                image_bytes = await photo.arrayBuffer()

                # 3. Perform OCR using Workers AI
                extracted_text = "No text extracted."
                if hasattr(self.env, "AI"):
                    ai_response = await self.env.AI.run(
                        "@cf/meta/llama-3.2-11b-vision-instruct",
                        {
                            "image": list(image_bytes),
                            "prompt": "Extract all readable text from this document exactly as written."
                        }
                    )
                    extracted_text = ai_response.get("response", "No text found.")

                text_filename = f"{doc_name}.txt"

                # 4. Return success response with extracted text
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
                # Returns detailed error string back to browser if parsing fails
                return Response(
                    json.dumps({"error": f"Backend Error: {str(err)}"}), 
                    status=500,
                    headers={"Content-Type": "application/json"}
                )

        return Response("Websaver API Running", status=200)