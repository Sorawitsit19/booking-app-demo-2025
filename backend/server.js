const express    = require('express');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const db         = require('./database');
const swaggerJsdoc = require('swagger-jsdoc');       // อ่าน JSDoc comment → สร้าง spec
const swaggerUi    = require('swagger-ui-express');   // serve spec เป็น Interactive UI

const app        = express();
const PORT=process.env.BACKEND_PORT || 5000;
//const PORT       = 5000;
// ─────────────────────────────────────────────────────────────
// Swagger / OpenAPI Configuration
// ─────────────────────────────────────────────────────────────
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Hotel Booking API',
      version:     '1.0.0',
      description: 'REST API สำหรับระบบจองห้องพักออนไลน์ — ใบงาน Lab02A',
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: 'Development Server' }
    ],
    components: {
      // Security Scheme — บอก Swagger ว่า API ใช้ Bearer JWT
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
        },
      },
      // Schema — โครงสร้างข้อมูลที่ใช้ซ้ำใน Request/Response
      schemas: {
        Booking: {
          type: 'object',
          required: ['fullname', 'email', 'phone', 'checkin', 'checkout', 'roomtype', 'guests'],
          properties: {
            id:         { type: 'integer', example: 1 },
            fullname:   { type: 'string',  example: 'สมชาย ใจดี' },
            email:      { type: 'string',  format: 'email', example: 'somchai@example.com' },
            phone:      { type: 'string',  example: '0812345678' },
            checkin:    { type: 'string',  format: 'date',  example: '2026-12-01' },
            checkout:   { type: 'string',  format: 'date',  example: '2026-12-03' },
            roomtype:   { type: 'string',  enum: ['standard', 'deluxe', 'suite'], example: 'standard' },
            guests:     { type: 'integer', minimum: 1, maximum: 4, example: 2 },
            status:     { type: 'string',  example: 'pending' },
            comment:    { type: 'string',  example: 'ต้องการห้องชั้นล่าง' },
            created_at: { type: 'string',  example: '2026-01-01T00:00:00.000Z' },
          },
        },
        LoginResponse: {
  type: 'object',
  properties: {
    token: {
      type: 'string',
      description: 'แก้ไข Login Response Description โดย wasuratsomdet9009'  // ← แก้ไข description เป็นการระบุว่า แก้ไข Response description โดยใคร
    },
    user: {
      type: 'object',
      properties: {
        id:       { type: 'integer' },
        username: { type: 'string' },
        role:     { type: 'string', enum: ['admin', 'user'] }
      }
    }
  }
}
      },
    },
  },
  // บอก swagger-jsdoc ให้อ่าน @swagger comment จากไฟล์เหล่านี้
  apis: ['./server.js'],
};

// สร้าง OpenAPI spec จาก options และ @swagger comments ในไฟล์
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Mount Swagger UI ที่ path /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

console.log(`📄 Swagger UI: http://localhost:${PORT}/api-docs`);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

app.use(cors());
app.use(express.json()); // Express 4.16+ — ไม่ต้องใช้ body-parser อีกต่อไป

// Middleware: ตรวจสอบ JWT Token ก่อนเข้าถึง protected routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อน' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    }
    req.user = user;
    next();
  });
};

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: เข้าสู่ระบบ
 *     description: ตรวจสอบ username/password และคืนค่า JWT Token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 example: admin123
 *     responses:
 *       200:
 *         description: เข้าสู่ระบบสำเร็จ — คืน JWT Token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: ไม่ได้ส่ง username หรือ password
 *       401:
 *         description: ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง
 */
// POST /api/login — ตรวจสอบ username/password และออก JWT
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'กรุณากรอก username และ password' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err)   return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  });
});

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: สร้างการจองใหม่
 *     description: สร้างข้อมูลการจองห้องพัก — ไม่ต้องการ Authentication
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Booking'
 *     responses:
 *       201:
 *         description: สร้างการจองสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       400:
 *         description: ข้อมูลไม่ครบถ้วน
 */
// POST /api/bookings — สร้างการจองใหม่ (ไม่ต้อง login)
app.post('/api/bookings', (req, res) => {
  const { fullname, email, phone, checkin, checkout, roomtype, guests } = req.body;
  const sql = `INSERT INTO bookings (fullname, email, phone, checkin, checkout, roomtype, guests)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

  db.run(sql, [fullname, email, phone, checkin, checkout, roomtype, guests], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    db.get('SELECT * FROM bookings WHERE id = ?', [this.lastID], (err, row) => {
      if (err) return res.status(400).json({ error: err.message });
      res.status(201).json(row);
    });
  });
});

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: ดึงข้อมูลการจองทั้งหมด
 *     description: ต้องการ JWT Token — กด Authorize ที่มุมบนขวาก่อนทดลองใช้
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 'จองห้องสำเร็จ  '
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Booking'
 *       401:
 *         description: ไม่ได้ส่ง Token
 *       403:
 *         description: Token ไม่ถูกต้องหรือหมดอายุ
 */
// GET /api/bookings — ดึงข้อมูลทั้งหมด (ต้อง login)
app.get('/api/bookings', authenticateToken, (req, res) => {
  db.all('SELECT * FROM bookings ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json(rows);
  });
});

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: ดึงข้อมูลการจองตาม ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID ของการจอง
 *         example: 1
 *     responses:
 *       200:
 *         description: ข้อมูลการจอง
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: ไม่ได้ส่ง Token
 *       404:
 *         description: ไม่พบข้อมูลการจอง
 */
// GET /api/bookings/:id — ดึงข้อมูลตาม ID (ต้อง login)
app.get('/api/bookings/:id', authenticateToken, (req, res) => {
  db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id], (err, row) => {
    if (err)  return res.status(400).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'ไม่พบข้อมูลการจอง' });
    res.json(row);
  });
});

/**
 * @swagger
 * /api/bookings/{id}:
 *   put:
 *     summary: แก้ไขข้อมูลการจอง
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Booking'
 *     responses:
 *       200:
 *         description: แก้ไขสำเร็จ คืนข้อมูลที่อัปเดตแล้ว
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Booking'
 *       401:
 *         description: ไม่ได้ส่ง Token
 *       404:
 *         description: ไม่พบข้อมูลการจอง
 */
// PUT /api/bookings/:id — อัปเดตการจอง (ต้อง login)
app.put('/api/bookings/:id', authenticateToken, (req, res) => {
  const { fullname, email, phone, checkin, checkout, roomtype, guests, comment } = req.body;
  const sql = `UPDATE bookings
               SET fullname=?, email=?, phone=?, checkin=?, checkout=?,
                   roomtype=?, guests=?, comment=?
               WHERE id=?`;

  db.run(sql, [fullname, email, phone, checkin, checkout, roomtype, guests, comment, req.params.id],
    function(err) {
      if (err)             return res.status(400).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลการจอง' });

      db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(400).json({ error: err.message });
        res.json(row);
      });
    }
  );
});

/**
 * @swagger
 * /api/bookings/{id}:
 *   delete:
 *     summary: ลบข้อมูลการจอง
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: ลบสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: ลบข้อมูลสำเร็จ }
 *                 id:      { type: string, example: "1" }
 *       401:
 *         description: ไม่ได้ส่ง Token
 *       404:
 *         description: ไม่พบข้อมูลการจอง
 */
// DELETE /api/bookings/:id — ลบการจอง (ต้อง login)
app.delete('/api/bookings/:id', authenticateToken, (req, res) => {
  db.run('DELETE FROM bookings WHERE id = ?', [req.params.id], function(err) {
    if (err)             return res.status(400).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'ไม่พบข้อมูลการจอง' });
    res.json({ message: 'ลบข้อมูลสำเร็จ', id: req.params.id });
  });
});
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: ตรวจสอบสถานะของ Server
 *     description: ใช้สำหรับ Health Check — ไม่ต้องการ Authentication
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server ทำงานปกติ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: string,  example: ok }
 *                 uptime:  { type: number,  example: 120.5 }
 *                 time:    { type: string,  example: '2026-01-01T00:00:00.000Z' }
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),    // จำนวนวินาทีที่ server รันมา
    time:   new Date().toISOString()
  });
});

/**
 * @swagger
 * /api/checkin:
 *   post:
 *     summary: เช็คอินเข้าห้องพัก
 *     description: ระบุ ID ของการจองเพื่อใช้ทำการเช็คอิน (แก้ไขโดย wasuratsomdet9009)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId]
 *             properties:
 *               bookingId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: สร้างการเช็คอินสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Check-in สำเร็จ }
 *                 bookingId: { type: integer, example: 1 }
 *                 status: { type: string, example: checked-in }
 *                 checkInTime: { type: string, example: '2026-04-01T12:00:00.000Z' }
 *                 by: { type: string, example: wasuratsomdet9009 }
 *       400:
 *         description: ข้อมูลไม่ครบ
 *       401:
 *         description: ไม่ได้ส่ง Token
 */
// เพิ่มเติมส่วน CheckIn โดย wasuratsomdet9009
app.post('/api/checkin', authenticateToken, (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) {
    return res.status(400).json({ error: 'กรุณาระบุ bookingId' });
  }
  // Mockup response
  res.json({
    message: 'Check-in สำเร็จ',
    bookingId: bookingId,
    status: 'checked-in',
    checkInTime: new Date().toISOString(),
    by: 'wasuratsomdet9009'
  });
});

/**
 * @swagger
 * /api/checkout:
 *   post:
 *     summary: เช็คเอาท์จากห้องพัก
 *     description: ระบุ ID ของการจองเพื่อใช้ทำการเช็คเอาท์ (แก้ไขโดย wasuratsomdet9009)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [checkInId]
 *             properties:
 *               checkInId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: ทำการเช็คเอาท์สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Check-out สำเร็จ }
 *                 checkInId: { type: integer, example: 1 }
 *                 amount: { type: number, example: 1500 }
 *                 status: { type: string, example: checked-out }
 *                 by: { type: string, example: wasuratsomdet9009 }
 *       400:
 *         description: ข้อมูลไม่ครบ
 *       401:
 *         description: ไม่ได้ส่ง Token
 */
// เพิ่มเติมส่วน CheckOut โดย wasuratsomdet9009
app.post('/api/checkout', authenticateToken, (req, res) => {
  const { checkInId } = req.body;
  if (!checkInId) {
    return res.status(400).json({ error: 'กรุณาระบุ checkInId' });
  }
  // Mockup response
  res.json({
    message: 'Check-out สำเร็จ',
    checkInId: checkInId,
    amount: 1500,
    status: 'checked-out',
    by: 'wasuratsomdet9009'
  });
});

/**
 * @swagger
 * /api/confirmcheckout:
 *   post:
 *     summary: ยืนยันการชำระเงินเช็คเอาท์
 *     description: ยืนยันการออกและการชำระเงิน (แก้ไขโดย wasuratsomdet9009)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [checkOutId]
 *             properties:
 *               checkOutId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: ยืนยันการชำระเงินสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: Confirm Check-out สำเร็จ }
 *                 checkOutId: { type: integer, example: 1 }
 *                 completed: { type: boolean, example: true }
 *                 by: { type: string, example: wasuratsomdet9009 }
 *       400:
 *         description: ข้อมูลไม่ครบ
 *       401:
 *         description: ไม่ได้ส่ง Token
 */
// เพิ่มเติมส่วน ConfirmCheckOut โดย wasuratsomdet9009
app.post('/api/confirmcheckout', authenticateToken, (req, res) => {
  const { checkOutId } = req.body;
  if (!checkOutId) {
    return res.status(400).json({ error: 'กรุณาระบุ checkOutId' });
  }
  // Mockup response
  res.json({
    message: 'Confirm Check-out สำเร็จ',
    checkOutId: checkOutId,
    completed: true,
    by: 'wasuratsomdet9009'
  });
});

app.listen(PORT, () => console.log(`Server running on port \${PORT}`));
