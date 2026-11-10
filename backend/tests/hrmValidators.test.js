// HRM people-data rules: what is cleaned and what is refused. No database.
const test = require("node:test");
const assert = require("node:assert/strict");
const rules = require("../services/hrm/validators");

const refuses = (fn, message) => assert.throws(fn, (e) => e.statusCode === 400 && message.test(e.message));

test("phones keep digits and a leading +, 10 to 15 digits", () => {
  assert.equal(rules.phone("+91 98765-43210", "Phone"), "+919876543210");
  assert.equal(rules.phone("(0771) 4012345", "Phone"), "+917714012345");
  assert.equal(rules.phone("8839229950", "Phone"), "+918839229950");
  assert.equal(rules.phone("+1 415 555 0100", "Phone"), "+14155550100");
  assert.equal(rules.phone("", "Phone"), null);
  refuses(() => rules.phone("98765abc10", "Phone"), /10 to 15 digits/);
  refuses(() => rules.phone("12345", "Phone"), /10 to 15 digits/);
  refuses(() => rules.phone("", "Phone", true), /required/);
});

test("names allow letters (any script), spaces and . ' -", () => {
  assert.equal(rules.personName("  Mallika   Paik ", "Full name", true), "Mallika Paik");
  assert.equal(rules.personName("D'Souza-Rao Jr.", "Full name"), "D'Souza-Rao Jr.");
  assert.equal(rules.personName("मल्लिका पाइक", "Full name"), "मल्लिका पाइक");
  refuses(() => rules.personName("Mallika2", "Full name"), /only letters/);
  refuses(() => rules.personName("-Mallika", "Full name"), /only letters/);
});

test("PAN and IFSC are upper-cased and checked", () => {
  assert.equal(rules.pan("abcde 1234f"), "ABCDE1234F");
  assert.equal(rules.ifsc("hdfc0001234"), "HDFC0001234");
  refuses(() => rules.pan("ABCD1234F"), /ABCDE1234F/);
  refuses(() => rules.ifsc("HDFC1001234"), /HDFC0001234/);
});

test("PIN, account number, UAN and employee code", () => {
  assert.equal(rules.pin("494 776"), "494776");
  refuses(() => rules.pin("49477"), /6 digits/);
  assert.equal(rules.accountNumber("1234 5678 9012"), "123456789012");
  refuses(() => rules.accountNumber("12345678"), /9 to 18/);
  assert.equal(rules.uan("1012 3456 7890"), "101234567890");
  refuses(() => rules.uan("10123456789"), /12 digits/);
  assert.equal(rules.employeeCode("BIO-0042"), "BIO-0042");
  refuses(() => rules.employeeCode("BIO 42!"), /letters, digits/);
});

test("emails are trimmed and lower-cased", () => {
  assert.equal(rules.email(" Mallika.Paik@Example.COM ", "Email"), "mallika.paik@example.com");
  refuses(() => rules.email("mallika@", "Email"), /Invalid email/);
});

test("date of birth must be past and at least 14 years back", () => {
  assert.equal(rules.dateOfBirth("2000-05-01", "2026-11-10"), "2000-05-01");
  assert.equal(rules.dateOfBirth("2012-11-10", "2026-11-10"), "2012-11-10");
  refuses(() => rules.dateOfBirth("2012-11-11", "2026-11-10"), /at least 14/);
  refuses(() => rules.dateOfBirth("2027-01-01", "2026-11-10"), /future/);
  refuses(() => rules.dateOfBirth("2000-02-30", "2026-11-10"), /valid calendar date/);
});
