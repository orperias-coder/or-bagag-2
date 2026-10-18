# עטיפה ל-launchd של הגיבוי הלילי של אור-בגג 2 (18.10.2026).
# שורש מוכח: zsh/cat שרצים מ-launchd מקבלים "Operation not permitted" על ~/Documents. ה-Python האמיתי
# קיבל מאור "גישה מלאה לדיסק", ותהליכי-בן שלו יורשים אותה — אז הוא מריץ את הסקריפט שבריפו כמו שהוא.
import subprocess, sys
sys.exit(subprocess.call(["/bin/zsh", "bin/backup-nightly.sh"], cwd="/Users/orperias/Documents/Claude/Projects/or-bagag-2"))
