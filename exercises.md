# K4 — Ngày 1: Bài Tập & Phản Ánh
## Khám Phá LLM API | Phiếu Thực Hành

**Thời lượng:** 4 tiếng
**Cách làm:** Trả lời từng câu ngay sau khi hoàn thành block tương ứng —
đừng để dồn hết về cuối buổi. Thay dòng `*Câu trả lời của bạn*` bằng câu
trả lời thật (chấm tự động sẽ đếm số câu đã trả lời).

---

## Block 1 — API Cơ Bản (trả lời sau Checkpoint 1)

### Câu 1.1 — Độ nhạy của temperature
Gọi `call_openai` với temperature 0.0, 0.5, 1.0 và 1.5 dùng prompt
**"Hãy kể cho tôi một sự thật thú vị về Việt Nam."**

**Bạn nhận thấy quy luật gì qua bốn phản hồi?** (2–3 câu)
> Trong bốn lần chạy, phản hồi ở `temperature=0.0` trực tiếp và ít biến tấu;
> ở 0.5 và 1.0, cách diễn đạt đa dạng và chi tiết hơn; còn ở 1.5, phản
> hồi sáng tạo nhưng dễ lan man hoặc chứa chi tiết kém chắc chắn. Kết quả này
> cho thấy temperature cao thường làm tăng độ ngẫu nhiên, nhưng đây là xu hướng
> quan sát chứ không bảo đảm mọi lần gọi đều cho cùng kết quả.

### Câu 1.2 — Chọn temperature cho sản phẩm
**Bạn sẽ đặt temperature bao nhiêu cho chatbot hỗ trợ khách hàng, và tại sao?**
> Tôi chọn `temperature=0.2` vì chatbot hỗ trợ khách hàng cần câu trả lời nhất
> quán, chính xác và bám sát chính sách. Mức thấp vẫn cho phép cách diễn đạt tự
> nhiên nhưng giảm nguy cơ model sáng tạo thêm thông tin không có căn cứ.

### Câu 1.3 — Đánh đổi chi phí
Kịch bản: 10.000 người dùng hoạt động mỗi ngày, mỗi người gọi API 3 lần,
mỗi lần trung bình ~350 token đầu ra.

**Ước tính GPT-4o đắt hơn GPT-4o-mini bao nhiêu lần cho workload này? Nêu một
trường hợp GPT-4o xứng đáng với chi phí và một trường hợp nên dùng mini:**
> Workload tạo `10.000 × 3 × 350 = 10.500.000` output token mỗi ngày. Theo bảng
> giá trong bài, chi phí output của GPT-4o là khoảng 105 USD/ngày, còn
> GPT-4o-mini là 6,30 USD/ngày, nên GPT-4o đắt hơn khoảng **16,7 lần** (chưa tính
> input token). GPT-4o đáng dùng cho phân tích hồ sơ phức tạp hoặc câu trả lời có
> ảnh hưởng lớn; mini phù hợp với FAQ, phân loại yêu cầu và các tác vụ lặp lại có
> lưu lượng cao.

---

## Block 2 — System Prompt & Token (trả lời sau Checkpoint 2)

### Câu 2.1 — Sức mạnh của persona
Gọi `chat_with_system_prompt` hai lần với cùng câu hỏi
**"Giải thích blockchain là gì?"** nhưng hai system prompt khác nhau:
- "Bạn là giáo viên tiểu học, giải thích thật đơn giản cho trẻ 8 tuổi."
- "Bạn là chuyên gia tài chính, trả lời chuyên sâu bằng thuật ngữ kỹ thuật."

**Hai phản hồi khác nhau như thế nào (độ dài, từ vựng, ví dụ)? System prompt
ảnh hưởng đến hành vi model ra sao?** (3–4 câu)
> Với persona giáo viên tiểu học, phản hồi ngắn hơn, dùng từ quen thuộc và ví
> blockchain như một quyển sổ chung mà nhiều người cùng giữ bản sao. Với persona
> chuyên gia tài chính, phản hồi dài và dùng các thuật ngữ như sổ cái phân tán,
> cơ chế đồng thuận, mật mã học và tính bất biến. Ví dụ ở bản đầu giúp trẻ hình
> dung, còn bản sau tập trung vào kiến trúc, rủi ro và ứng dụng tài chính. Như vậy,
> system prompt định hướng đối tượng độc giả, giọng điệu, mức độ chuyên sâu và
> cách model tổ chức câu trả lời dù câu hỏi của người dùng không đổi.

### Câu 2.2 — tiktoken vs đếm từ
Chọn một đoạn văn tiếng Việt ~100 từ. So sánh số token theo `count_tokens`
(tiktoken) với ước lượng `số từ / 0.75` mà Part 1 đã dùng.

**Hai con số chênh nhau bao nhiêu phần trăm? Vì sao tiếng Việt thường tốn
nhiều token hơn tiếng Anh cùng độ dài?**
> Đoạn tôi dùng là: “Trí tuệ nhân tạo đang thay đổi cách sinh viên học tập, tìm
> kiếm thông tin và giải quyết vấn đề. Trong lớp học, công cụ AI có thể giải thích một
> khái niệm theo nhiều cách và đưa ra ví dụ phù hợp. Tuy nhiên, sinh viên không nên sao
> chép câu trả lời một cách máy móc. Các em cần kiểm tra nguồn, đối chiếu dữ kiện và tự
> giải thích lại kết quả bằng hiểu biết của mình. Khi được sử dụng có trách nhiệm,
> AI trở thành một trợ lý hữu ích, nhưng tư duy phản biện và trách nhiệm cuối cùng vẫn
> thuộc về con người.” Đoạn này có 111 từ; `count_tokens` với model `gpt-4o` trả
> về 130 token, còn công thức `111 / 0.75` ước lượng 148 token. Công thức gần
> đúng cao hơn 18 token, tương đương **12,16% so với giá trị ước lượng**.
> Nguyên nhân là tokenizer tách văn bản thành các token con thay vì đếm từ theo
> khoảng trắng; cách viết theo âm tiết và mức độ bao phủ tiếng Việt trong bộ từ
> vựng của tokenizer có thể khiến tiếng Việt cần nhiều token hơn tiếng Anh có độ
> dài tương đương. Kết quả cụ thể còn phụ thuộc vào nội dung, model và bộ mã hóa.

---

## Block 3 — Streaming & Độ Bền (trả lời sau Checkpoint 3)

### Câu 3.1 — Trải nghiệm người dùng với streaming
**Streaming quan trọng nhất trong trường hợp nào, và khi nào thì
non-streaming lại phù hợp hơn?** (1 đoạn văn)
> Streaming quan trọng nhất khi model tạo câu trả lời dài hoặc có độ trễ cao,
> chẳng hạn chatbot, trợ lý viết nội dung và sinh mã, vì người dùng thấy phần đầu
> ngay lập tức và biết hệ thống đang hoạt động. Non-streaming phù hợp hơn khi kết
> quả ngắn, phải được kiểm tra hoặc biến đổi toàn bộ trước khi hiển thị, hoặc khi
> ứng dụng cần một JSON hoàn chỉnh để xử lý tự động; cách này cũng làm logic phía
> client đơn giản hơn.

### Câu 3.2 — Vì sao backoff theo cấp số nhân?
**So với delay cố định (ví dụ luôn chờ 1 giây), exponential backoff có lợi
thế gì khi API bị quá tải? Điều gì xảy ra nếu hàng nghìn client cùng retry
với delay cố định giống nhau?**
> Exponential backoff tăng dần thời gian chờ sau mỗi lần lỗi, nhờ đó giảm số
> request gửi tới dịch vụ đang quá tải và cho hệ thống thêm thời gian phục hồi.
> Nếu hàng nghìn client cùng retry sau đúng một giây, chúng có thể đồng loạt tạo
> ra một đợt tải mới (hiện tượng *thundering herd*) và làm lỗi kéo dài. Trong hệ
> thống thực tế nên cộng thêm jitter ngẫu nhiên để các lần retry không tiếp tục
> trùng thời điểm.

---

## Block 4 — Mini-Project (trả lời sau Checkpoint 4)

### Câu 4.1 — Thiết kế persona
**Bạn chọn persona gì cho trợ lý của mình? Viết lại system prompt đó và giải
thích 1–2 lựa chọn từ ngữ quan trọng trong prompt (ví dụ: vì sao yêu cầu
"trả lời ngắn gọn", vì sao chỉ định ngôn ngữ...):**
> System prompt của tôi là: **“Bạn là trợ giảng thân thiện của khóa AI, trả lời
> ngắn gọn bằng tiếng Việt. Khi chưa đủ thông tin, hãy nói rõ điều cần hỏi thêm
> thay vì đoán.”** Cụm “trả lời ngắn gọn bằng tiếng Việt” giúp phản hồi dễ đọc và
> phù hợp với học viên của khóa học. Yêu cầu “nói rõ điều cần hỏi thêm thay vì
> đoán” nhằm hạn chế câu trả lời thiếu căn cứ.

### Câu 4.2 — Hạn chế & cải thiện
**Trợ lý của bạn hiện có hạn chế lớn nhất là gì (ví dụ: history chỉ 3 lượt,
không có bộ nhớ dài hạn, không kiểm duyệt nội dung...)? Đề xuất một cải
thiện cụ thể và mô tả ngắn cách triển khai:**
> Hạn chế lớn nhất là trợ lý chỉ giữ ba lượt hội thoại gần nhất, nên có thể quên
> mục tiêu hoặc thông tin quan trọng được nêu từ đầu phiên. Tôi sẽ bổ sung một
> bản tóm tắt hội thoại: trước khi loại các message cũ, hệ thống dùng model tạo
> tóm tắt ngắn các dữ kiện và quyết định cần nhớ, lưu nó riêng, rồi gửi phần tóm
> tắt cùng ba lượt gần nhất trong mỗi request. Cách này giữ được ngữ cảnh dài hơn
> mà không làm số input token tăng mãi.

---

## Danh Sách Kiểm Tra Nộp Bài

- [ ] `python grade.py` — xem điểm tự động, mục tiêu ≥ 75/100
- [ ] Cả 4 checkpoint pytest đều pass
- [ ] Tất cả 9 câu trong file này đã được trả lời
- [ ] Đã copy bài làm vào folder `solution/`, push lên fork và dán link trên trang bài Lab ở VLearn trước 23:59 ngày 11/09/2026
