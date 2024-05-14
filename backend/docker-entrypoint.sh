#!/bin/bash

npx sequelize-cli db:migrate
chmod 664 ./db/*.sqlite
npm start
