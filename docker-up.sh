docker build -t cssartist .
docker run -d -p 54322:3000 --name cssartist --restart always cssartist
