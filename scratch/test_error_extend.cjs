class PostgrestError extends Error {
  constructor(message) {
    super(message);
    this.details = "details";
    this.hint = "hint";
    this.code = "123";
  }
}

const err = new PostgrestError("test message");
console.log("JSON.stringify:", JSON.stringify(err));
console.log("String(err):", String(err));
console.log("err.message:", err.message);
