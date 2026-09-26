#!/bin/zsh
# מד-גודל — הגנה מפני "עוד ועוד קוד". תקרות: 6 לשוניות ראשיות, 14 מסכים פנימיים, 3000 שורות. נכשל (exit 1) כשעוברים.
cd "$(dirname "$0")/.." || exit 1
TABS=$(grep -o 'data-tab="[a-z]*"' index.html | sort -u | wc -l | tr -d ' ')
SCREENS=$(grep -o 'class="view"' index.html | wc -l | tr -d ' ')
LINES=$(cat index.html app.js data.js quote.js style.css print.css sw.js | wc -l | tr -d ' ')
ACTIONS=$(grep -o 'data-act="[a-z-]*"' index.html app.js quote.js | sort -u | wc -l | tr -d ' ')
echo "לשוניות=$TABS (מקס' 6) · מסכים פנימיים=$SCREENS (מקס' 14) · שורות=$LINES (מקס' 3000) · פעולות שונות=$ACTIONS"
[ "$TABS" -le 6 ] && [ "$SCREENS" -le 14 ] && [ "$LINES" -le 3000 ] || { echo "עברנו את התקרה — מורידים לפני שמוסיפים"; exit 1; }
