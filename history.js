import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Firebase config (same as main)
const firebaseConfig = {
  apiKey: "AIzaSyAAc3sRW7WuQXbvlVKKdb8pFa3UOpidalM",
  authDomain: "my-scorer.firebaseapp.com",
  projectId: "my-scorer",
  storageBucket: "my-scorer.firebasestorage.app",
  messagingSenderId: "243500946215",
  appId: "1:243500946215:web:bd976f1bd437edce684f02"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);

// DOM elements
const historyList = document.getElementById("historyList");
const badgesContainer = document.getElementById("badgesContainer");
const streakContainer = document.getElementById("streakContainer");

onAuthStateChanged(auth, async (user) => {
    if(!user){
        alert("Please login first!");
        window.location.href = "index.html";
        return;
    }

    const uid = user.uid;
    const userSnap = await getDoc(doc(db, "users", uid));
    if(!userSnap.exists()){
        alert("User data not found.");
        window.location.href = "index.html";
        return;
    }

    const userData = userSnap.data();

    // Display streak
    streakContainer.innerHTML = `<p>🔥 Current Streak: ${userData.streak || 0} days</p>`;

    // Display badges
    const badges = userData.badges || [];
    badgesContainer.innerHTML = badges.map(b=>`<div class="achievement-card">${b}</div>`).join('');

    // Display session history
    const sessions = userData.sessions || [];
    if(sessions.length === 0){
        historyList.innerHTML = "<p>No sessions yet!</p>";
        return;
    }

    historyList.innerHTML = sessions.map((s,i)=>{
        const date = s.date.toDate().toLocaleDateString();
        const arrowTotals = s.ends.map(end => end.reduce((a,b)=>a+b,0));
        const avgScore = (s.totalScore / s.endsCount).toFixed(1);
        return `
            <div class="history-item">
                <p><strong>Session ${i+1} - ${date}</strong></p>
                <p>Bow: ${s.bowStyle}, Distance: ${s.distance}m</p>
                <p>Total Score: ${s.totalScore}, Average/End: ${avgScore}</p>
                <p>End Scores: ${arrowTotals.join(" | ")}</p>
            </div>
        `;
    }).join('');
});
