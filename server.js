import express from "express";
import fs from "fs";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

const MEMORY_FILE = "memory.json";

let memory = {
  conversations: [],
  currentChatId: null
};

if (fs.existsSync(MEMORY_FILE)) {
  memory = JSON.parse(fs.readFileSync(MEMORY_FILE));
}

function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

app.get("/conversations", (req, res) => {
  res.json(memory);
});

app.post("/new-chat", (req, res) => {
  const newChat = {
    id: Date.now().toString(),
    messages: []
  };

  memory.conversations.unshift(newChat);
  memory.currentChatId = newChat.id;
  saveMemory();

  res.json(newChat);
});

app.post("/chat", async (req, res) => {
  const { message } = req.body;

  if (!memory.currentChatId) {
    return res.json({ reply: "Create a new chat first." });
  }

  const chat = memory.conversations.find(
    c => c.id === memory.currentChatId
  );

  chat.messages.push({ role: "user", message });

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            { role: "system", content: "You are AIVO AI assistant." },
            { role: "user", content: message }
          ]
        })
      }
    );

    const data = await response.json();

    console.log("GROQ:", data);

    let reply = "No response from model";

    if (data.choices && data.choices[0]) {
      reply = data.choices[0].message.content;
    } else if (data.error) {
      reply = data.error.message;
    }

    chat.messages.push({ role: "assistant", message: reply });

    saveMemory();

    res.json({ reply });

  } catch (error) {
    console.error(error);
    res.json({ reply: "AI connection failed." });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 AIVO AI running on port ${PORT}`);
});