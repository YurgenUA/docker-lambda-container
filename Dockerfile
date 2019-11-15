FROM node:10.16.3-buster

ENV AWS_LAMBDA_FUNCTION_EVENT {}
ENV AWS_LAMBDA_FUNCTION_CONTEXT {}

# Same working dir as in AWS Lambda execution environment   
WORKDIR /var/task

COPY . .

RUN npm install

# Parameters are passed via environments variables
CMD ["sh", "-c", "node ./runner.js"]

