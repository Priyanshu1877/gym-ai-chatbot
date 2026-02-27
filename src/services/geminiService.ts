export const getFitnessAdvice = async (message: string, history: { role: string, parts: { text: string }[] }[]) => {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to fetch response");
  }
  const data = await res.json();
  return data.text;
};
