import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";
import Logo from "./assets/logo.png";
import { BASE_URL } from  "./api";

// dotenv.config();
function App() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [answer, setAnswer] = useState("");
  const [displayedAnswer, setDisplayedAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [assistantTitle, setAssistantTitle] = useState("Insurance");


  const chatWindowRef = useRef(null);
// below code is responsible for writing single word at a time rather than whole ans at a time so that user 
// think like machine is generating its ans same thing hapeen with chatgpt as well
  useEffect(() => {
    if (!answer) return;
    let index = 0;
    setDisplayedAnswer("");
    const interval = setInterval(() => {
      setDisplayedAnswer((prev) => prev + answer[index]);
      index++;
      if (index >= answer.length) {
        clearInterval(interval);
        setMessages((prev) => [...prev, { from: "bot", text: answer }]);
        setAnswer("");
        setDisplayedAnswer("")
      }
    }, 30);
    return () => clearInterval(interval);
  }, [answer]);

  useEffect(() => {
    chatWindowRef.current?.scrollTo({
      top: chatWindowRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, displayedAnswer]);

  const handleAsk = async () => {
    if (!query.trim()) return;
    setMessages((prev) => [...prev, { from: "user", text: query }]);
    setQuery("");
    setLoading(true);
    setAnswer("");
    setDisplayedAnswer("");

    try {
      const res = await axios.post(
        `${BASE_URL}/ask`,
        { query },
        {
          headers: {
            Authorization: "Bearer YOUR_TOKEN_HERE",
            "Content-Type": "application/json",
          },
        }
      );
      setAnswer(res.data.answer || "No answer returned.");
    } catch (error) {
      console.error(error);
      setAnswer("Error fetching answer. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="header">
      <div className="logo">
  <img src={Logo} alt="AI Logo" />
</div>
<div>
  {assistantTitle} AI Assistant
  <div className="sub-header">Answers from your uploaded PDFs</div>
</div>
</div>

      <div className="chat-window" ref={chatWindowRef}>
        {/* Welcome message (only when chat is empty) */}
  {messages.length === 0 && !displayedAnswer && (
    <div className="welcome-message">
      <p>Hi there! I’m your AI Assistant.</p>
      <p>Ask me anything....</p>
    </div>
  )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-bubble ${msg.from === "user" ? "user-bubble" : "bot-bubble"}`}
          >
            {msg.text}
          </div>
        ))}
        {displayedAnswer && (
          <div className="chat-bubble bot-bubble">{displayedAnswer}</div>
        )}
      </div>
      <div className="input-container">
        <input
          type="text"
          placeholder="Ask something..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
        />
        <button onClick={handleAsk} disabled={loading}>
          {loading ? "Thinking..." : "Ask"}
        </button>
      </div>
    </div>
  );
}

export default App;
