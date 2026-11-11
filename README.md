# Supawit Studio — ห้องทำงาน 3D แบบโต้ตอบได้

เว็บห้องทำงานแบบ isometric สร้างด้วย Vite + Three.js ใช้โมเดลที่ export มาจาก `../isometric_room.blend`

## รันโปรเจกต์

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # ได้ไฟล์ static ใน dist/
```

เปิดโหมดกลางคืนตั้งแต่โหลดหน้า: `http://localhost:5173/?mode=night`

## โครงสร้าง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `public/models/room.glb` | โมเดลห้องที่ export จาก Blender |
| `src/main.js` | renderer, กล้อง, แสง, bloom/outline, โหลดโมเดลและแก้ material |
| `src/interactions.js` | วัตถุที่คลิกได้, แอนิเมชัน, info card, แผงควบคุม |
| `src/textures.js` | texture ที่วาดด้วย canvas (จอ, พื้นไม้, วิวนอกหน้าต่าง) และสร้าง UV |

## วัตถุที่โต้ตอบได้

จอ ultrawide (เปลี่ยนหน้าจอ) · จอแนวตั้ง · เก้าอี้ (หมุน/เลื่อนเข้าโต๊ะ) · ลิ้นชัก 3 ชั้น · PC (เปลี่ยนสี RGB) ·
ไฟ softbox · แอร์ (บานสวิงเปิดและมีลมเย็น) · ม่านม้วน · หน้าต่าง (สลับกลางวัน/กลางคืน) · ป้ายโลโก้ ·
ผนังระแนงและไฟ LED · หูฟัง · คีย์บอร์ด (ไฟ RGB) · เมาส์ · มือถือ · Stream Deck · กระเป๋า · ต้นไม้

## แก้โมเดลใน Blender แล้วอัปเดตเว็บ

Export collection `Room` เป็น glTF Binary (`.glb`) โดยเปิด **Apply Modifiers** ไม่ต้อง export Lights/Cameras
แล้วบันทึกทับ `public/models/room.glb` ชื่อ object ต้องคงเดิม เพราะ `interactions.js` อ้างถึงวัตถุด้วยชื่อ
