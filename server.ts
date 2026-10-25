import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '25mb' }));

// Shared server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    clinic: 'NKAG Care - BSCKI. Danh Thanh Tâm',
    address: '31 Ngô Văn Sở, Phường Rạch Giá, Tỉnh An Giang',
    hotline: '0566.19.3979',
    website: 'https://www.nkag.vn',
  });
});

// AI Medical Assistant Consultation
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, userQuery, context } = req.body;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Chưa cấu hình GEMINI_API_KEY trong hệ thống.',
      });
    }

    const systemPrompt = `Bạn là Trợ lý Y khoa Ảo chính thức của Phòng khám Nam Khoa An Giang (NKAG Care) do Bác sĩ Chuyên khoa I (BSCKI) Danh Thanh Tâm phụ trách.
Thông tin phòng khám:
- Phụ trách chuyên môn: BSCKI. Danh Thanh Tâm (tốt nghiệp ĐHYD TP.HCM, chuyên khoa Tiết Niệu - Nam Khoa).
- Phương châm: "Tận Tâm - Chu Đáo - Chuyên Nghiệp".
- Địa chỉ: 31 Ngô Văn Sở, Phường Rạch Giá, Tỉnh An Giang.
- Hotline / Cấp cứu: 0566.19.3979.
- Zalo tư vấn bảo mật: 0566.19.3979 (https://zalo.me/0566193979).
- Website: https://www.nkag.vn.
- Lịch làm việc:
  + Thứ 2 – Thứ 6: Sáng 11h00 - 13h00 | Chiều 17h00 - 19h00
  + Thứ 7: Khám theo lịch hẹn trước
  + Chủ Nhật: Sáng 9h00 - 11h00 | Chiều 15h00 - 19h00
- Các chuyên khoa nổi bật:
  1. Cắt bao quy đầu thẩm mỹ bằng máy Stapler Surkon thế hệ mới (nhanh 5-10 phút, không đau, ít chảy máu, hồi phục 7 ngày) & nong dính bao quy đầu, vệ sinh bã Smegma cho trẻ em.
  2. Rối loạn sinh lý nam: Xuất tinh sớm (phác đồ hành vi + tập Kegel + điều chỉnh ngưỡng cảm giác), rối loạn cương dương (IIEF-5).
  3. Bệnh lây truyền qua đường tình dục (STDs): Lậu, sùi mào gà, Herpes, Chlamydia (xét nghiệm Real-time PCR 12 tác nhân bảo mật, trả kết quả nhanh).
  4. Sức khỏe sinh sản & cấp cứu: Xét nghiệm tinh dịch đồ chuẩn WHO, cấp cứu đứt dây hãm (dây thắng) bao quy đầu, viêm nhiễm bao quy đầu cấp tính.

Phong cách tư vấn:
- Ngôn ngữ: Tiếng Việt, ấm áp, kín đáo, tôn trọng tuyệt đối tính riêng tư của bệnh nhân nam giới.
- Giải thích khoa học, súc tích, dễ hiểu, tránh gây hoang mang lo lắng quá mức.
- Luôn khuyến nghị bệnh nhân: thông tin AI mang tính tham khảo y khoa sơ bộ; để chẩn đoán chính xác và kê toa điều trị, bệnh nhân nên bấm đặt lịch hoặc nhắn trực tiếp Zalo 0566.19.3979 cho BSCKI. Danh Thanh Tâm.`;

    const chatHistory = Array.isArray(messages) ? messages : [];
    const contents: any[] = [];

    // Add previous turns
    for (const msg of chatHistory) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    // Add current user prompt
    contents.push({
      role: 'user',
      parts: [{
        text: `${context ? `[Bối cảnh người dùng: ${context}]\n` : ''}${userQuery}`,
      }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    return res.json({
      text: response.text || 'Xin lỗi, tôi chưa thể xử lý câu trả lời lúc này. Vui lòng liên hệ trực tiếp Zalo 0566.19.3979 của BS Tâm.',
    });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return res.status(500).json({
      error: error.message || 'Lỗi khi kết nối với AI Assistant',
    });
  }
});

// AI Medical Image Generation
app.post('/api/ai/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio = '1:1', imageSize = '1K' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mô tả hình ảnh cần tạo.' });
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'Chưa cấu hình GEMINI_API_KEY trong hệ thống.' });
    }

    let resultImageUrl: string | null = null;
    let textDescription = '';

    // First attempt with gemini-nano-banana-2.1 as requested in text block
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: {
          parts: [{ text: `High quality medical, anatomical, or clinical healthcare educational illustration: ${prompt}` }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: imageSize,
          },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          resultImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textDescription += part.text;
        }
      }
    } catch (err: any) {
      console.warn('Fallback from gemini-nano-banana-2.1 to gemini-3.1-flash-lite-image:', err.message);
      // Fallback attempt with gemini-3.1-flash-lite-image
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: `Clinical medical illustration, clean educational infographic: ${prompt}` }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      });

      const parts = fallbackResponse.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          resultImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textDescription += part.text;
        }
      }
    }

    if (!resultImageUrl) {
      return res.status(500).json({
        error: 'Không tìm thấy dữ liệu ảnh được tạo từ AI.',
        textDescription,
      });
    }

    return res.json({
      imageUrl: resultImageUrl,
      description: textDescription,
    });
  } catch (error: any) {
    console.error('Image Generation Error:', error);
    return res.status(500).json({
      error: error.message || 'Lỗi khi tạo ảnh qua Gemini AI',
    });
  }
});

// AI Medical Image Editing
app.post('/api/ai/edit-image', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', prompt } = req.body;
    if (!imageBase64 || !prompt) {
      return res.status(400).json({ error: 'Cần cung cấp dữ liệu ảnh gốc và yêu cầu chỉnh sửa.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    let resultImageUrl: string | null = null;
    let textDescription = '';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          resultImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textDescription += part.text;
        }
      }
    } catch (err: any) {
      console.warn('Fallback edit to gemini-3.1-flash-lite-image:', err.message);
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      const parts = fallbackResponse.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          resultImageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textDescription += part.text;
        }
      }
    }

    if (!resultImageUrl) {
      return res.status(500).json({
        error: 'Chưa nhận được ảnh đã chỉnh sửa từ AI.',
        textDescription,
      });
    }

    return res.json({
      imageUrl: resultImageUrl,
      description: textDescription,
    });
  } catch (error: any) {
    console.error('Image Edit Error:', error);
    return res.status(500).json({
      error: error.message || 'Lỗi khi chỉnh sửa ảnh qua Gemini AI',
    });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(port, () => {
    console.log(`NKAG Care Server listening on port ${port} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer();
