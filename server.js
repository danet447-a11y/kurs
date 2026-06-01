const express = require('express')
const cors = require('cors')
const mysql = require('mysql2/promise')
require('dotenv').config()

const app = express()

app.use(cors())
app.use(express.json())

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

app.get('/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM product')
    res.json(rows)
  } catch (e) {
    res.status(500).json(e.message)
  }
})

app.get("/ping", (req, res) => {
  res.json({ ok:  true});
})

app.listen(process.env.PORT || 10000, () => {
  console.log('Server started')
})
