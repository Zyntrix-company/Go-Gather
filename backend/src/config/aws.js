const { S3Client } = require('@aws-sdk/client-s3');
const { SESClient } = require('@aws-sdk/client-ses');
const { SNSClient } = require('@aws-sdk/client-sns');
const config = require('./index');

const awsCredentials = {
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
};

const s3Client = new S3Client(awsCredentials);

const sesCredentials = {
  region: config.aws.region,
  credentials: {
    accessKeyId: config.ses.accessKeyId || config.aws.accessKeyId,
    secretAccessKey: config.ses.secretAccessKey || config.aws.secretAccessKey,
  },
};
const sesClient = new SESClient(sesCredentials);

const snsClient = new SNSClient(awsCredentials);

module.exports = { s3Client, sesClient, snsClient };
