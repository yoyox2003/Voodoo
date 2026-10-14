import FullCalendar, { useCalendarController, type EventInput } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import classicTheme from "@fullcalendar/react/themes/classic";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "./CalendarPage.css";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CalendarTaskList } from "../components/CalendarTaskList";
import { useLocalToday } from "../hooks/useLocalToday";
import { useWorkspaceOutlet } from "../hooks/useWorkspaceOutlet";
import { dueDateKey } from "../lib/dueDates";
import { PageFrame, WorkspacePageStatus } from "./PageState";
import { Button } from "../UI/Button";

const calendarPlugins = [classicTheme, dayGridPlugin, interactionPlugin];

export function CalendarPage() {
  const workspace = useWorkspaceOutlet();
  const today = useLocalToday();
  // null follows today even if the page stays open across midnight.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const selectedDay = pickedDay ?? today;
  const controller = useCalendarController();
  const navigate = useNavigate();

  const events = useMemo<EventInput[]>(
    () =>
      workspace.tasks.flatMap((task) => {
        const day = dueDateKey(task.dueDate);
        if (!day) return [];
        return [
          {
            id: task.id,
            title: task.title,
            start: day,
            allDay: true,
            url: `/tasks/${task.id}`,
            extendedProps: { completed: task.isDone },
          },
        ];
      }),
    [workspace.tasks],
  );

  if (workspace.isLoading || workspace.isError) {
    return (
      <PageFrame title="Calendar" wide>
        <WorkspacePageStatus {...workspace} />
      </PageFrame>
    );
  }

  return (
    <PageFrame title="Calendar" wide>
      <p className="mt-3 text-sm text-[#77716b] dark:text-[#aaa29b]">
        Your task deadlines, one day at a time.
      </p>
      <Button className="mt-6" onClick={() => navigate(`/tasks/new?dueDate=${selectedDay}`, { state: { returnTo: "/calendar" } })}>
        Create task for this day
      </Button>
      <div className="mt-9 grid min-w-0 gap-10 xl:grid-cols-[minmax(0,1fr)_260px]">
        <section className="voodoo-calendar min-w-0" aria-label="Task due date calendar">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 aria-live="polite" className="text-lg font-semibold">
              {controller.view?.title ??
                new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
            </h2>
            <div className="flex items-center gap-1">
              <button
                className="voodoo-calendar-control"
                type="button"
                onClick={() => {
                  controller.gotoDate(today);
                  setPickedDay(null);
                }}
              >
                Today
              </button>
              <button
                className="voodoo-calendar-control"
                type="button"
                aria-label="Previous month"
                onClick={() => controller.prev()}
              >
                <ChevronLeft aria-hidden="true" size={18} />
              </button>
              <button
                className="voodoo-calendar-control"
                type="button"
                aria-label="Next month"
                onClick={() => controller.next()}
              >
                <ChevronRight aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
          <FullCalendar
            controller={controller}
            plugins={calendarPlugins}
            initialView="dayGridMonth"
            initialDate={today}
            now={`${today}T00:00:00Z`}
            timeZone="UTC"
            headerToolbar={false}
            height="auto"
            fixedWeekCount={false}
            dayMaxEvents={2}
            events={events}
            editable={false}
            navLinks
            navLinkHint={(dateText) => `Show tasks for ${dateText}`}
            navLinkDayClick={(date) => {
              const day = date.toISOString().slice(0, 10);
              setPickedDay(day === today ? null : day);
            }}
            dayCellTopInnerClass="voodoo-day-button"
            dayCellClass={(info) =>
              info.date.toISOString().slice(0, 10) === selectedDay ? "voodoo-day-selected" : ""
            }
            dayCellInnerClass="voodoo-calendar-cell"
            dateClick={(info) => setPickedDay(info.dateStr === today ? null : info.dateStr)}
            moreLinkClick={(info) => {
              setPickedDay(info.date.toISOString().slice(0, 10));
              return "popover";
            }}
            eventClass={(info) =>
              info.event.extendedProps.completed ? "voodoo-event-completed" : ""
            }
            eventContent={(info) => (
              <span className="inline-flex max-w-full items-center gap-1">
                <span className="shrink-0">
                  {info.event.extendedProps.completed ? (
                    <Check aria-hidden="true" size={12} />
                  ) : null}
                </span>
                <span className="truncate">{info.event.title}</span>
              </span>
            )}
            eventClick={(info) => {
              info.jsEvent.preventDefault();
              navigate(`/tasks/${info.event.id}`);
            }}
          />
          {events.length === 0 && (
            <p className="mt-4 text-sm text-[#77716b] dark:text-[#aaa29b]">
              No scheduled tasks yet. Open a task to set its due date.
            </p>
          )}
          <p className="mt-4 text-xs text-[#77716b] dark:text-[#aaa29b]">
            Select a day to see all its tasks. Completed tasks remain visible.
          </p>
        </section>
        <div className="grid content-start gap-9" aria-live="polite">
          <CalendarTaskList day={today} title="Due today" workspace={workspace} />
          {selectedDay !== today && (
            <CalendarTaskList day={selectedDay} title="Selected day" workspace={workspace} />
          )}
        </div>
      </div>
    </PageFrame>
  );
}
