docker build -t draw .
docker run -d -p 54320:3000 --name drawboard --restart always draw