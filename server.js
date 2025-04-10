import express from 'express';
import connectDB from './config/db.js';
import dotenv from 'dotenv';
import multer from 'multer';
import cors from 'cors';
import authRoutes from './routes/auth.js';

import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// ✅ Correct CORS configuration
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
}));

app.use(express.json());

const upload = multer({ dest: 'uploads/' });

app.post('/api/upload', upload.single('resume'), (req, res) => {
  // if (!req.file) {
  //   console.log("❌ No file received");
  //   return res.status(400).json({ error: "No file uploaded" });
  // }

  const uploadedPath = path.resolve(__dirname, req.file.path);
  const pythonPath = path.resolve(__dirname, 'venv/bin/python3.11'); // update if needed
  const scriptPath = path.resolve(__dirname, 'skill_extractor.py');

  console.log("🧠 Running Python:");
  console.log("→ Python:", pythonPath);
  console.log("→ Script:", scriptPath);
  console.log("→ PDF:", uploadedPath);

  exec(`"${pythonPath}" "${scriptPath}" "${uploadedPath}"`, {
    env: {
      ...process.env,
      PATH: `${path.join(__dirname, 'venv/bin')}:${process.env.PATH}`,
      VIRTUAL_ENV: path.resolve(__dirname, 'venv')
    }
  }, (err, stdout, stderr) => {
    if (err) {
      console.error("❌ Python Error:", stderr);
      return res.status(500).json({ error: stderr });
    }

    console.log("✅ Python Output:", stdout);
    const outputLines = stdout.split('\n').filter(l => l.trim() !== '');
    const results = [];

    for (let i = 0; i < outputLines.length; i++) {
      if (/^\d+\./.test(outputLines[i])) {
        results.push({
          title: outputLines[i],
          location: outputLines[i + 1]?.split(': ')[1] || '',
          stipend: outputLines[i + 2]?.split(': ')[1] || '',
          link: outputLines[i + 3]?.split(': ')[1] || '',
          apply: outputLines[i + 4]?.split(': ')[1] || ''
        });
      }
    }

    return res.status(200).json({ raw_output: stdout });
  });
});

connectDB();

app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));