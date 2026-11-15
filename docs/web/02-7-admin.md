# 2.7 Admin và upload ảnh

Hợp đồng tại thời điểm Giai đoạn 2.7. Các route và chính sách hiện tại nằm trong [hợp đồng A1](05-admin-api.md).

| Method | Route dưới /api/v1 | Hợp đồng |
| --- | --- | --- |
| GET | /admin/orders | Phân trang page/limit. DTO gồm id, status, totalPrice, itemCount và các mốc thời gian. |
| PATCH | /admin/orders/:id/status | Body expectedStatus và status. Chỉ cho pending → shipped → delivered. Status hiện tại bằng đích trả 200 và giữ mốc thời gian gốc. |
| POST | /admin/uploads/signature | Body sizeBytes và contentType. Trả uploadUrl, apiKey, signature, params, maxBytes, expiresAt. |

Admin guard kiểm tra primary email đã xác minh từ Clerk. Transaction cập nhật order với điều kiện trạng thái kỳ vọng và upsert notification trong cùng lần commit. Các lần gửi đồng thời cùng đích trả kết quả đã lưu. Admin list đọc projection tối thiểu và dùng index additive theo createdAt + ID.

Upload giới hạn lời khai ở 5 MiB, định dạng JPEG/PNG/WebP, và 5 lần ký/phút/IP. Server tạo public ID riêng cho mỗi ảnh, ký asset_folder và public_id dưới products, giới hạn định dạng và đặt overwrite=false. Cloudinary phải dùng dynamic folder mode để xử lý asset_folder. Dùng form-data với file, api_key, signature và nguyên các params nhận được. TTL do Cloudinary áp dụng là một giờ tính từ timestamp ký. [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference) · [Hiệu lực chữ ký](https://cloudinary.com/documentation/authentication_signatures)

Vì browser gửi byte trực tiếp sang Cloudinary, API chỉ xác thực dung lượng khai báo. Preset Cloudinary không có trần dung lượng riêng, nên 5 MiB cũng là giới hạn client cần áp dụng. Nếu cần cưỡng chế 5 MiB trên byte thực thì cần upload qua server. Cloudinary còn loại file và resource_type khỏi dữ liệu ký. API trả URL image cố định và các tham số có chữ ký, còn policy phía cloud cần được kiểm chứng bằng account thật. [Cloudinary Upload Presets](https://cloudinary.com/documentation/upload_presets) · [Tham số chữ ký](https://cloudinary.com/documentation/upload_images)
