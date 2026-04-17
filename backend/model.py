import sys

text = sys.argv[1].lower()

fake_words = ["shocking", "breaking", "secret", "exclusive", "click"]
real_words = ["official", "government", "report", "statement"]

score = 0

for word in fake_words:
    if word in text:
        score += 1

for word in real_words:
    if word in text:
        score -= 1

if score > 0:
    print("FAKE")
else:
    print("REAL")
