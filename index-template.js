const AWS = require('aws-sdk');
const http = require('http');

// placeholder to substitute before invocation
const handler = require('%%pathToHandler%%');

lambdaFunctionName = '';

async function saveResponseInDB(err, data, functionName) {
  const meta = await new Promise((resolve, reject) => {
    http.get(`${process.env.ECS_CONTAINER_METADATA_URI}/task`, (res) => {
      res.setEncoding('utf8');
      let body = ''; 
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));

    }).on('error', reject);
  
  });
  // use Task ID as unique identifier
  const thisTaskId = JSON.parse(meta).TaskARN.split('/')[1];
  console.log('- thisTaskId', thisTaskId);

  const docClient = new AWS.DynamoDB.DocumentClient({region: process.env.AWS_REGION});
  const params = {
    TableName:'pdflib-task-response',
    Item:{
        "lambda": functionName,
        "task": thisTaskId,
        status: err? 'Error' : 'Success',
        result: err? err: data,
        ttl: Math.round(Date.now() / 1000) + 24 * 60 * 60
    }
  };
  await docClient.put(params).promise();
}

// this will be called at the end of ANY our Lambda. It has same signature as standars callback
async function toolboxCallback(err, data) {
  // to pass Lambda execution result use DynamoDB. On other end, ECS Task ID is always available and can be used to get result
  await saveResponseInDB(err, data, lambdaFunctionName);
  if (err) {
    console.error('Lambda returned error', err);
    return;
  }
}



async function wrapper() {
  const context = JSON.parse(process.env.AWS_LAMBDA_FUNCTION_CONTEXT);
  context.fail = async (err) => {
    await toolboxCallback(err);
  }
  const event = JSON.parse(process.env.AWS_LAMBDA_FUNCTION_EVENT);
  lambdaFunctionName = context.functionName;
  // same to original Lambda exported handler. Pass here orginal context & event
  const result = await handler.handler(event, context, toolboxCallback);

  return result;
}

wrapper();