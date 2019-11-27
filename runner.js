const path = require('path');
const https = require('https');
const fs = require('fs');
const child_process = require('child_process');
const AWS = require('aws-sdk');
const promisePipe = require('promisepipe');
const unzipper = require('unzipper');


const runner = async () => {
  const { AWS_LAMBDA_FUNCTION_CONTEXT } = process.env;
  const REGION = process.env.AWS_REGION || 'eu-west-1';
  // context & event both have same as originally invoked Lambda with data
  const context = JSON.parse(AWS_LAMBDA_FUNCTION_CONTEXT);

  if (!context.functionName) {
    return console.error('Required function name not found in context.');
  }

  const originalInvoking = context.functionName;
  try {
    const lambda = new AWS.Lambda({ region: REGION });
    // get URL to Lambda ZIP archive
    const lambdaInfo = await lambda
      .getFunction({ FunctionName: originalInvoking })
      .promise();
    const sourceCodeSignedUrl = lambdaInfo.Code.Location;
    const LAMBDA_ROOT_PATH = '/var/task';
    const pathToHandler = path.resolve(
      `${LAMBDA_ROOT_PATH}/${lambdaInfo.Configuration.Handler.split('.')[0]}`
    );
    
    return https.get(sourceCodeSignedUrl, async res => {
      // Download source from cloud and extract it in the current directory at the same time.
      await promisePipe(res, unzipper.Extract({ path: __dirname }));
      // read index-template.js, substitute param and write to runner-child-process.js
      const  indexTemplateContent = fs.readFileSync('./index-template.js', {encoding: 'utf8'});
      const amendedContent = indexTemplateContent.replace('%%pathToHandler%%', pathToHandler);
      fs.writeFileSync('./runner-child-process.js', amendedContent, {encoding: 'utf8'});

      // run original Lambda as child proces
      const childProcessEnv = process.env;
      childProcessEnv.REGION = REGION;
      const execOutput = child_process.execFileSync('node',
      [ path.resolve(__dirname, './runner-child-process.js') ], { 
        cwd: __dirname,
        env: childProcessEnv,
        stdio: 'inherit'
       });      
      console.log('-- execFileSync returned:', execOutput);

    });

  } catch (err) {
    console.error(err.message);
    throw err;
  }    
};

return runner();