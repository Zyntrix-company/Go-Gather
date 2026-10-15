jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../../src/config/aws', () => ({
  s3Client: {},
  sesClient: { send: jest.fn() },
  snsClient: { send: jest.fn() },
}));

const axios = require('axios');
const config = require('../../src/config');
const { sendEmail } = require('../../src/utils/mailer');

describe('Brevo email tags', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    config.brevo.apiKey = 'xkeysib-test';
    config.brevo.fromEmail = 'hello@example.com';
    axios.post.mockResolvedValue({ data: { messageId: 'm1' } });
  });

  const sentPayload = () => axios.post.mock.calls[0][1];

  it('defaults to transactional/auth, as before', async () => {
    await sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>' });
    expect(sentPayload().tags).toEqual(['transactional', 'auth']);
  });

  it('lets invite emails tag themselves transactional/invite', async () => {
    await sendEmail({ to: 'a@b.com', subject: 's', html: '<p>x</p>', tags: ['transactional', 'invite'] });
    expect(sentPayload().tags).toEqual(['transactional', 'invite']);
  });
});
