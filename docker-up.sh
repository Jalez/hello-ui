docker build -t cssartist2 .
docker run -d -p 54322:3000 --name cssartist2 --restart always cssartist2
