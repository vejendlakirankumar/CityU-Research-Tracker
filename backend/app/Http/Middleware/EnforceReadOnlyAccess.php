<?php

namespace App\Http\Middleware;

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\DocumentAnnotationController;
use App\Http\Controllers\GatedReleaseController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\SimilarityController;
use App\Http\Controllers\SsoAuthController;
use App\Http\Controllers\SubmissionAuthorController;
use App\Http\Controllers\SubmissionController;
use App\Http\Controllers\SubmissionEmailController;
use App\Http\Controllers\SubmissionMeetingController;
use App\Http\Controllers\SubmissionMessageController;
use App\Http\Controllers\SubmissionReviewerController;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnforceReadOnlyAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user()?->hasRole('readonly')) {
            return $next($request);
        }

        $action = $request->route()->getActionName();
        $accountActions = [
            'POST' => [AuthController::class . '@logout'],
            'PATCH' => [AuthController::class . '@changePassword'],
        ];
        if (in_array($action, $accountActions[$request->method()] ?? [], true)) {
            return $next($request);
        }

        $readActions = [
            AuthController::class => ['me'],
            SsoAuthController::class => ['listIdentities'],
            DashboardController::class => ['stats'],
            SubmissionController::class => [
                'index', 'show', 'myReviews', 'activityLog', 'feedback',
                'reviewProgress', 'listVersions', 'downloadFile', 'calendarDeadlines',
            ],
            SubmissionReviewerController::class => ['index', 'downloadAnnotatedDocument', 'downloadDocument'],
            SubmissionAuthorController::class => ['index'],
            DocumentAnnotationController::class => ['index'],
            SubmissionMessageController::class => ['index'],
            SubmissionMeetingController::class => ['index'],
            SubmissionEmailController::class => ['index'],
            SimilarityController::class => ['result'],
            GatedReleaseController::class => ['showForSubmission'],
            NotificationController::class => ['index', 'unreadCount'],
            AnalyticsController::class => ['overview', 'turnaround', 'reviewerLoad', 'metrics'],
        ];
        [$controller, $method] = array_pad(explode('@', $action, 2), 2, null);
        if (in_array($request->method(), ['GET', 'HEAD'], true)
            && in_array($method, $readActions[$controller] ?? [], true)) {
            return $next($request);
        }

        return response()->json([
            'message' => 'Read-only access: you may view submissions, documents, assignments, and reports, but cannot make changes or access administration.',
        ], 403);
    }
}
