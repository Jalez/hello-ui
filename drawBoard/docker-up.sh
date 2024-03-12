# this is run in tie-lukioplus.rd.tuni.fi
# check /plussa/apache.conf
# currently bound to the address tie-lukioplus.rd.tuni.fi/drawboard2/
docker build -t draw .
docker run -d -p 54320:3000 --name drawboard2 --restart always draw
