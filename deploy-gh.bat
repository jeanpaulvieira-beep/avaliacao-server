@echo off
set PATH=%PATH%;C:\Program Files\GitHub CLI
cd /d C:\Users\Simulador\.openclaw\workspace\avaliacao-server
git init
git add -A
git commit -m "Sistema de Avaliacao de Desempenho - Node.js + SQLite"
gh repo create avaliacao-server --public --source=. --push
