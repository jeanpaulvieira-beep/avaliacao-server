@echo off
set PATH=%PATH%;C:\Program Files\GitHub CLI
cd /d C:\Users\Simulador\.openclaw\workspace\avaliacao-server
git add -A
git commit -m "add render.yaml blueprint"
git push origin master
