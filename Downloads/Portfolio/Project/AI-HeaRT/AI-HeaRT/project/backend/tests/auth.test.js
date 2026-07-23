const request = require("supertest");
const createApp = require("../src/app");

const app = createApp();

function uniquePhone() {
  // Cambodian-format local numbers, 9 digits after the leading 0.
  const n = Math.floor(100000000 + Math.random() * 899999999);
  return `0${n}`;
}

describe("Registration + OTP verification", () => {
  test("registers a new phone number and returns a mock OTP", async () => {
    const phone = uniquePhone();
    const res = await request(app).post("/api/auth/register").send({ phoneNumber: phone });

    expect(res.status).toBe(201);
    expect(res.body.phoneNumber).toMatch(/^\+855\d+$/);
    expect(res.body.devCode).toMatch(/^\d{6}$/);
  });

  test("rejects an invalid phone number", async () => {
    const res = await request(app).post("/api/auth/register").send({ phoneNumber: "abc123" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_phone");
  });

  test("completes registration with the correct OTP and issues a session", async () => {
    const phone = uniquePhone();
    const reg = await request(app).post("/api/auth/register").send({ phoneNumber: phone });
    const code = reg.body.devCode;

    const verify = await request(app)
      .post("/api/auth/verify")
      .send({ phoneNumber: phone, code, purpose: "register" });

    expect(verify.status).toBe(200);
    expect(verify.body.patient.isVerified).toBe(true);
    expect(verify.body.session.token).toMatch(/^[a-f0-9]{64}$/);
  });

  test("rejects an incorrect OTP and reduces remaining attempts", async () => {
    const phone = uniquePhone();
    await request(app).post("/api/auth/register").send({ phoneNumber: phone });

    const wrong = await request(app)
      .post("/api/auth/verify")
      .send({ phoneNumber: phone, code: "000000", purpose: "register" });

    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe("incorrect_code");
    expect(wrong.body.error.message).toMatch(/attempt/i);
  });

  test("locks out after max attempts and requires a new code", async () => {
    const phone = uniquePhone();
    await request(app).post("/api/auth/register").send({ phoneNumber: phone });

    // OTP_MAX_ATTEMPTS is set to 3 in the test env — 3 wrong attempts consume
    // the attempt budget, and the 4th request is the one that reports the lockout.
    await request(app).post("/api/auth/verify").send({ phoneNumber: phone, code: "111111", purpose: "register" });
    await request(app).post("/api/auth/verify").send({ phoneNumber: phone, code: "111111", purpose: "register" });
    await request(app).post("/api/auth/verify").send({ phoneNumber: phone, code: "111111", purpose: "register" });

    const fourth = await request(app)
      .post("/api/auth/verify")
      .send({ phoneNumber: phone, code: "111111", purpose: "register" });

    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe("too_many_attempts");

    // The code is now consumed, so any further attempt (even correct-shaped) needs a fresh OTP.
    const fifth = await request(app)
      .post("/api/auth/verify")
      .send({ phoneNumber: phone, code: "111111", purpose: "register" });

    expect(fifth.status).toBe(400);
    expect(fifth.body.error.code).toBe("no_pending_code");
  });

  test("rejects a duplicate registration for an already-verified phone number", async () => {
    const phone = uniquePhone();
    const reg = await request(app).post("/api/auth/register").send({ phoneNumber: phone });
    await request(app)
      .post("/api/auth/verify")
      .send({ phoneNumber: phone, code: reg.body.devCode, purpose: "register" });

    const secondReg = await request(app).post("/api/auth/register").send({ phoneNumber: phone });
    expect(secondReg.status).toBe(409);
    expect(secondReg.body.error.code).toBe("phone_already_registered");
  });

  test("treats differently-formatted phone numbers as the same account", async () => {
    // 012 345 678 and +855 12 345 678 and 85512345678 should all normalize the same way.
    const localFormat = "012345678";
    const reg = await request(app).post("/api/auth/register").send({ phoneNumber: localFormat });
    await request(app)
      .post("/api/auth/verify")
      .send({ phoneNumber: localFormat, code: reg.body.devCode, purpose: "register" });

    const intlFormat = "+855 12 345 678";
    const secondReg = await request(app).post("/api/auth/register").send({ phoneNumber: intlFormat });
    expect(secondReg.status).toBe(409); // same underlying account, already verified
  });
});

describe("Login flow", () => {
  async function registerAndVerify(phone) {
    const reg = await request(app).post("/api/auth/register").send({ phoneNumber: phone });
    await request(app)
      .post("/api/auth/verify")
      .send({ phoneNumber: phone, code: reg.body.devCode, purpose: "register" });
  }

  test("rejects login for a phone number that was never registered", async () => {
    const res = await request(app).post("/api/auth/login").send({ phoneNumber: uniquePhone() });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("phone_not_registered");
  });

  test("logs in an existing verified account with a fresh OTP", async () => {
    const phone = uniquePhone();
    await registerAndVerify(phone);

    const loginReq = await request(app).post("/api/auth/login").send({ phoneNumber: phone });
    expect(loginReq.status).toBe(200);
    expect(loginReq.body.devCode).toMatch(/^\d{6}$/);

    const verify = await request(app)
      .post("/api/auth/verify")
      .send({ phoneNumber: phone, code: loginReq.body.devCode, purpose: "login" });

    expect(verify.status).toBe(200);
    expect(verify.body.session.token).toBeTruthy();
  });
});

describe("Authenticated patient routes", () => {
  async function registerAndGetToken() {
    const phone = uniquePhone();
    const reg = await request(app).post("/api/auth/register").send({ phoneNumber: phone });
    const verify = await request(app)
      .post("/api/auth/verify")
      .send({ phoneNumber: phone, code: reg.body.devCode, purpose: "register" });
    return { phone, token: verify.body.session.token };
  }

  test("rejects requests with no token", async () => {
    const res = await request(app).get("/api/patient/me");
    expect(res.status).toBe(401);
  });

  test("rejects requests with a garbage token", async () => {
    const res = await request(app).get("/api/patient/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  test("returns the patient profile with a valid token", async () => {
    const { token } = await registerAndGetToken();
    const res = await request(app).get("/api/patient/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.patient.isVerified).toBe(true);
  });

  test("updates the patient profile", async () => {
    const { token } = await registerAndGetToken();
    const res = await request(app)
      .put("/api/patient/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Sovann", age: 19, gender: "male", weightKg: 62, language: "km" });

    expect(res.status).toBe(200);
    expect(res.body.patient.name).toBe("Sovann");
    expect(res.body.patient.age).toBe(19);
    expect(res.body.patient.language).toBe("km");
  });

  test("saves and lists symptom-check history", async () => {
    const { token } = await registerAndGetToken();

    const save = await request(app)
      .post("/api/patient/symptom-checks")
      .set("Authorization", `Bearer ${token}`)
      .send({
        symptoms: ["cough", "high_fever"],
        results: [{ disease: "Common Cold", probability: 50 }],
        triage: "green",
      });
    expect(save.status).toBe(201);
    expect(save.body.symptomCheck.id).toBeTruthy();

    const list = await request(app)
      .get("/api/patient/symptom-checks")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.symptomChecks.length).toBe(1);
    expect(list.body.symptomChecks[0].symptoms).toEqual(["cough", "high_fever"]);
  });

  test("logout revokes the session token", async () => {
    const { token } = await registerAndGetToken();

    const logout = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${token}`);
    expect(logout.status).toBe(204);

    const after = await request(app).get("/api/patient/me").set("Authorization", `Bearer ${token}`);
    expect(after.status).toBe(401);
  });

  test("one patient cannot see another patient's symptom checks", async () => {
    const patientA = await registerAndGetToken();
    const patientB = await registerAndGetToken();

    await request(app)
      .post("/api/patient/symptom-checks")
      .set("Authorization", `Bearer ${patientA.token}`)
      .send({ symptoms: ["cough"], results: [], triage: "green" });

    const bList = await request(app)
      .get("/api/patient/symptom-checks")
      .set("Authorization", `Bearer ${patientB.token}`);

    expect(bList.status).toBe(200);
    expect(bList.body.symptomChecks.length).toBe(0);
  });
});
