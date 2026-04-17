const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const { exec } = require("child_process");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ================= MYSQL CONNECTION =================
const db = mysql.createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "Imnot@17",   // change if needed
  database: "fakenews"
});

db.connect((err) => {
  if (err) {
    console.log("Database connection failed:", err);
  } else {
    console.log("Connected to MySQL ✅");
  }
});

// ================= MAIN API =================
app.post("/analyze", (req, res) => {
  const text = req.body.text;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  console.log("Input:", text);

  // ================= AI LOGIC =================
  let fakeWords = ["shocking", "secret", "click", "exclusive", "fake", "viral"];
  let realWords = ["official", "government", "report", "statement", "announced", "confirmed"];

  let textLower = text.toLowerCase();
  let score = 0;

  // Fake signals (+1)
  fakeWords.forEach(word => {
    if (textLower.includes(word)) {
      score += 1;
    }
  });

  // Real signals (-1)
  realWords.forEach(word => {
    if (textLower.includes(word)) {
      score -= 1;
    }
  });

  // Final decision (IMPORTANT LOGIC)
  let result;
  if (score >= 2) result = "FAKE";
  else if (score <= -1) result = "REAL";
  else result = "UNCERTAIN";

  // ================= HADOOP PART =================

  // Save input locally
  fs.writeFileSync("input.txt", text);

  // Clean HDFS
  exec("hdfs dfs -rm -r /fakenews/output || true", () => {
    exec("hdfs dfs -rm -r /fakenews/input || true", () => {

      exec("hdfs dfs -mkdir -p /fakenews/input", () => {

        exec("hdfs dfs -put input.txt /fakenews/input", (err) => {
          if (err) {
            console.log("HDFS PUT error:", err);
            return res.send("HDFS error");
          }

          // Run Hadoop
          const command = `hadoop jar $HADOOP_HOME/share/hadoop/tools/lib/hadoop-streaming*.jar \
-input /fakenews/input \
-output /fakenews/output \
-mapper "python3 mapper.py" \
-reducer "python3 reducer.py"`;

          exec(command, (err, stdout, stderr) => {

            if (err) {
              console.log("Hadoop error:", stderr);
              return res.send("Hadoop processing error");
            }

            // Read output
            exec("hdfs dfs -cat /fakenews/output/part-00000", (err, output) => {

              if (err) {
                console.log("Read error:", err);
                return res.send("Output read error");
              }

              console.log("Hadoop Output:\n", output);

              // Save to MySQL
              db.query(
                "INSERT INTO results (text, result) VALUES (?, ?)",
                [text, result],
                (err) => {
                  if (err) {
                    console.log("DB error:", err);
                  }
                }
              );

              // Send response
              res.json({
                text,
                result,
                score,
                hadoop_output: output
              });

            });

          });

        });

      });

    });
  });

});

// ================= START SERVER =================
app.listen(5000, () => {
  console.log("Server running on port 5000 🚀");
});

// ================= ERROR HANDLER =================
process.on("uncaughtException", (err) => {
  console.error("Unhandled Error:", err);
});
