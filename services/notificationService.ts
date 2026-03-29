import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import moment from 'moment';
import { CalendarEvent } from '../types';

export const requestNotificationPermissions = async () => {
    if (Capacitor.isNativePlatform()) {
        const { display } = await LocalNotifications.requestPermissions();
        return display === 'granted';
    }
    return true; // Web fallback or ignore
};

export interface ReminderSetting {
    value: number;
    unit: 'minutes' | 'hours' | 'days' | 'weeks';
}

const getUnitLabel = (unit: string, value: number) => {
    if (unit === 'minutes') return value === 1 ? 'دقيقة' : value === 2 ? 'دقيقتين' : `${value} دقائق`;
    if (unit === 'hours') return value === 1 ? 'ساعة' : value === 2 ? 'ساعتين' : `${value} ساعات`;
    if (unit === 'days') return value === 1 ? 'يوم' : value === 2 ? 'يومين' : `${value} أيام`;
    if (unit === 'weeks') return value === 1 ? 'أسبوع' : value === 2 ? 'أسبوعين' : `${value} أسابيع`;
    return '';
};

export const scheduleEventNotifications = async (
    events: CalendarEvent[],
    reminder1: ReminderSetting = { value: 1, unit: 'weeks' },
    reminder2: ReminderSetting = { value: 1, unit: 'days' }
) => {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
        console.error('Notification permission not granted.');
        return false;
    }

    try {
        // Clear existing scheduled notifications to avoid duplicates
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel({ notifications: pending.notifications });
        }

        const notificationsToSchedule = [];
        let idCounter = 1;

        for (const event of events) {
            const eventStart = moment(event.start);
            const now = moment();

            // Only schedule if the event is in the future
            if (eventStart.isAfter(now)) {
                // Schedule reminder 1
                const notifyTime1 = eventStart.clone().subtract(reminder1.value, reminder1.unit).toDate();
                
                if (notifyTime1 > now.toDate()) {
                    notificationsToSchedule.push({
                        id: idCounter++,
                        title: 'تذكير بنشاط قادم',
                        body: `النشاط: ${event.title} سيبدأ بعد ${getUnitLabel(reminder1.unit, reminder1.value)}.`,
                        schedule: { at: notifyTime1 }
                    });
                }

                // Schedule reminder 2
                const notifyTime2 = eventStart.clone().subtract(reminder2.value, reminder2.unit).toDate();
                if (notifyTime2 > now.toDate()) {
                    notificationsToSchedule.push({
                        id: idCounter++,
                        title: 'تذكير بنشاط قادم',
                        body: `النشاط: ${event.title} سيبدأ بعد ${getUnitLabel(reminder2.unit, reminder2.value)}.`,
                        schedule: { at: notifyTime2 }
                    });
                }
            }
        }

        if (notificationsToSchedule.length > 0) {
            await LocalNotifications.schedule({
                notifications: notificationsToSchedule
            });
            return true;
        }

        return true;
    } catch (error) {
        console.error('Error scheduling notifications:', error);
        // Fallback for web or if plugin fails
        if (!Capacitor.isNativePlatform()) {
            alert('ملاحظة: الإشعارات المحلية تعمل بشكل كامل فقط عند تثبيت التطبيق على الهاتف (Android/iOS).');
            return true; // Return true to avoid showing the failure alert in the UI
        }
        return false;
    }
};
