// export const BASE_URL = "https://devtinder-4-lld2.onrender.com";

let BASE_URL = "";
if (window.location.hostname === "localhost") {
  BASE_URL = "http://localhost:8080";
} else {
  BASE_URL = "https://rag-based-chat-application-backend.onrender.com";

  
             
}

export  {BASE_URL};

