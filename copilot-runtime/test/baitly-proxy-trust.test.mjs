import assert from 'node:assert/strict';
import { test } from 'node:test';
import proxyaddr from 'proxy-addr';

// Reserved documentation addresses only; no listening server or live request.
test('an IPv4-mapped IPv6 prefix shorter than the mapped marker does not trust arbitrary IPv4', () => {
  const trust = proxyaddr.compile('::ffff:10.0.0.0/8');
  assert.equal(trust('203.0.113.7'), false);
  assert.equal(trust('198.51.100.9'), false);
});

test('a broad ordinary IPv6 subnet does not implicitly trust IPv4', () => {
  assert.equal(proxyaddr.compile('::/1')('203.0.113.7'), false);
});

test('correct IPv4 and mapped IPv6 trust subnets keep their intended scope', () => {
  for (const subnet of ['10.0.0.0/8', '::ffff:10.0.0.0/104']) {
    const trust = proxyaddr.compile(subnet);
    assert.equal(trust('10.1.2.3'), true);
    assert.equal(trust('203.0.113.7'), false);
  }
});

test('untrusted peers cannot supply their own forwarded identity', () => {
  const request = { socket: { remoteAddress: '203.0.113.7' },
    headers: { 'x-forwarded-for': '198.51.100.9' } };
  assert.equal(proxyaddr(request, proxyaddr.compile('::ffff:10.0.0.0/8')), '203.0.113.7');
});

test('valid trusted proxy chains and direct connections retain their behavior', () => {
  const trust = proxyaddr.compile('10.0.0.0/8');
  const forwarded = { socket: { remoteAddress: '10.1.2.3' },
    headers: { 'x-forwarded-for': '198.51.100.9' } };
  assert.equal(proxyaddr(forwarded, trust), '198.51.100.9');
  assert.equal(proxyaddr({ socket: { remoteAddress: '203.0.113.7' }, headers: {} }, trust), '203.0.113.7');
});
