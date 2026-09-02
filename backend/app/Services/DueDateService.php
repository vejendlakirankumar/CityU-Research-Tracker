<?php

namespace App\Services;

use App\Models\OrganizationSetting;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Computes reviewer due dates, optionally excluding weekends and/or public
 * holidays based on the organization's review settings. When both toggles are
 * off this behaves exactly like a plain calendar addDays().
 */
class DueDateService
{
    /**
     * Add {@see $days} to {@see $base}, skipping weekends and/or public
     * holidays when the corresponding organization settings are enabled.
     */
    public static function compute(CarbonInterface $base, int $days): Carbon
    {
        $date = $base instanceof Carbon ? $base->copy() : Carbon::parse($base);

        if ($days <= 0) {
            return $date;
        }

        $org              = OrganizationSetting::current();
        $excludeWeekends  = (bool) ($org->due_date_exclude_weekends ?? false);
        $considerHolidays = (bool) ($org->due_date_consider_holidays ?? false);

        if (! $excludeWeekends && ! $considerHolidays) {
            return $date->addDays($days);
        }

        $country  = $org->grace_period_holidays_country ?: 'US';
        $holidays = $considerHolidays
            ? array_merge(
                self::publicHolidays($country, $date->year),
                self::publicHolidays($country, $date->year + 1),
            )
            : [];

        $added = 0;
        while ($added < $days) {
            $date->addDay();

            if ($excludeWeekends && $date->isWeekend()) {
                continue;
            }
            if ($considerHolidays && in_array($date->toDateString(), $holidays, true)) {
                continue;
            }

            $added++;
        }

        return $date;
    }

    /**
     * Public holiday dates (YYYY-MM-DD) for a country + year. Basic built-in
     * list — extend or replace with an external source as needed.
     */
    public static function publicHolidays(string $country, int $year): array
    {
        $holidays = [
            'US' => [
                "{$year}-01-01", // New Year's
                "{$year}-07-04", // Independence Day
                "{$year}-11-11", // Veterans Day
                "{$year}-12-25", // Christmas
                "{$year}-12-26", // Boxing Day
            ],
            'GB' => [
                "{$year}-01-01",
                "{$year}-12-25",
                "{$year}-12-26",
            ],
            'HK' => [
                "{$year}-01-01",
                "{$year}-01-29", // Lunar New Year
                "{$year}-01-30",
                "{$year}-01-31",
                "{$year}-04-04", // Ching Ming
                "{$year}-04-18", // Good Friday
                "{$year}-04-21", // Easter Monday
                "{$year}-05-01", // Labour Day
                "{$year}-05-05", // Buddha's Birthday
                "{$year}-07-01", // Establishment Day
                "{$year}-10-01", // National Day
                "{$year}-10-07", // Chung Yeung
                "{$year}-12-25",
                "{$year}-12-26",
            ],
        ];

        return $holidays[$country] ?? $holidays['US'];
    }
}
