<?php

namespace App\Mail;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\MessageConverter;

/**
 * Symfony/Laravel mail transport that delivers messages through the
 * Microsoft Graph API (Microsoft 365) using the OAuth2 client-credentials
 * flow.
 *
 * Registered as the "graph" mailer driver in App\Providers\AppServiceProvider,
 * so any code that sends via the Mail facade (stage emails, test emails,
 * Mailables) works transparently once the admin selects the "graph" driver.
 *
 * Requires an Entra app registration with the *application* permission
 * Mail.Send (admin-consented). The From address must be a licensed mailbox
 * the app is permitted to send as.
 */
class GraphTransport extends AbstractTransport
{
    public function __construct(
        private readonly string $tenantId,
        private readonly string $clientId,
        private readonly string $clientSecret,
        private readonly ?string $defaultFrom = null,
    ) {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());

        $from = $this->resolveFrom($email);

        $graphMessage = [
            'subject' => $email->getSubject() ?? '',
            'body'    => [
                'contentType' => $email->getHtmlBody() !== null ? 'HTML' : 'Text',
                'content'     => $email->getHtmlBody() ?? $email->getTextBody() ?? '',
            ],
            'toRecipients' => $this->recipients($email->getTo()),
        ];

        if ($cc = $this->recipients($email->getCc())) {
            $graphMessage['ccRecipients'] = $cc;
        }
        if ($bcc = $this->recipients($email->getBcc())) {
            $graphMessage['bccRecipients'] = $bcc;
        }
        if ($replyTo = $this->recipients($email->getReplyTo())) {
            $graphMessage['replyTo'] = $replyTo;
        }
        if ($attachments = $this->attachments($email)) {
            $graphMessage['attachments'] = $attachments;
        }

        $response = Http::withToken($this->accessToken())
            ->post(
                'https://graph.microsoft.com/v1.0/users/' . rawurlencode($from) . '/sendMail',
                [
                    'message'         => $graphMessage,
                    'saveToSentItems' => false,
                ]
            );

        if ($response->status() !== 202) {
            throw new RuntimeException(
                'Microsoft Graph email failed: ' . $response->status() . ' ' . $response->body()
            );
        }
    }

    /**
     * Acquire (and cache) an application access token via client credentials.
     */
    private function accessToken(): string
    {
        $cacheKey = 'graph_mail_token:' . md5($this->tenantId . '|' . $this->clientId);

        $cached = Cache::get($cacheKey);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $response = Http::asForm()->post(
            "https://login.microsoftonline.com/{$this->tenantId}/oauth2/v2.0/token",
            [
                'client_id'     => $this->clientId,
                'client_secret' => $this->clientSecret,
                'scope'         => 'https://graph.microsoft.com/.default',
                'grant_type'    => 'client_credentials',
            ]
        );

        if (!$response->successful()) {
            throw new RuntimeException(
                'Unable to obtain Microsoft Graph token: ' . $response->status() . ' ' . $response->body()
            );
        }

        $token = (string) $response->json('access_token');
        // Refresh a minute before expiry to avoid using a stale token mid-request.
        $ttl = max(60, (int) $response->json('expires_in', 3600) - 60);
        Cache::put($cacheKey, $token, $ttl);

        return $token;
    }

    private function resolveFrom(Email $email): string
    {
        $from = $email->getFrom();
        if (!empty($from)) {
            return $from[0]->getAddress();
        }

        if ($this->defaultFrom) {
            return $this->defaultFrom;
        }

        throw new RuntimeException('No From address configured for the Microsoft Graph mail transport.');
    }

    /**
     * @param Address[] $addresses
     * @return array<int, array{emailAddress: array{address: string, name?: string}}>
     */
    private function recipients(array $addresses): array
    {
        return array_map(function (Address $a) {
            $entry = ['address' => $a->getAddress()];
            if ($a->getName() !== '') {
                $entry['name'] = $a->getName();
            }
            return ['emailAddress' => $entry];
        }, $addresses);
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function attachments(Email $email): array
    {
        $out = [];
        foreach ($email->getAttachments() as $attachment) {
            $headers  = $attachment->getPreparedHeaders();
            $filename = $attachment->getFilename() ?? 'attachment';
            $type     = $headers->get('Content-Type')?->getBody() ?? 'application/octet-stream';

            $out[] = [
                '@odata.type'  => '#microsoft.graph.fileAttachment',
                'name'         => $filename,
                'contentType'  => $type,
                'contentBytes' => base64_encode($attachment->getBody()),
            ];
        }
        return $out;
    }

    public function __toString(): string
    {
        return 'graph://microsoft';
    }
}
