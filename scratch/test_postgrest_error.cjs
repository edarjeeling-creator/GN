class PostgrestError {
  constructor(message) {
    this.message = message;
    this.details = "details";
    this.hint = "hint";
    this.code = "123";
  }
}

const err = new PostgrestError("test message");
console.log("JSON.stringify:", JSON.stringify(err));
