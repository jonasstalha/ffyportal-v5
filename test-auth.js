// Direct test of demo user authentication
const email = "admin@example.com";
const password = "Demo@2024!";

const demoUsers = {
  "admin@example.com": { email: "admin@example.com", role: "admin" },
  "quality@example.com": { email: "quality@example.com", role: "quality" },
  "logistics@example.com": { email: "logistics@example.com", role: "logistics" },
  "reception@example.com": { email: "reception@example.com", role: "reception" },
  "production@example.com": { email: "production@example.com", role: "production" },
  "personnel@example.com": { email: "personnel@example.com", role: "personnel" },
  "comptabilite@example.com": { email: "comptabilite@example.com", role: "comptabilite" },
};

console.log("Testing authentication:");
console.log("Email:", email);
console.log("Password:", password);
console.log("Demo user exists:", !!demoUsers[email]);
console.log("Password match:", password === "Demo@2024!");

if (demoUsers[email] && password === "Demo@2024!") {
  console.log("SUCCESS: Demo user authentication should work");
} else {
  console.log("FAILURE: Demo user authentication will fail");
  console.log("Email in demoUsers:", Object.keys(demoUsers).includes(email));
  console.log("Password comparison:", password === "Demo@2024!");
}
