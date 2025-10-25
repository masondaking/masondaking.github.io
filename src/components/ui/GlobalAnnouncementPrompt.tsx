import { AnimatePresence, motion } from "framer-motion";
import { Heart, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useAnnouncements } from "../../context/AnnouncementsContext";

export function GlobalAnnouncementPrompt() {
  const { user } = useAuth();
  const { announcement, dismissedBy, heartedBy, dismissForUser, toggleHeart } = useAnnouncements();

  const isDismissed = user ? Boolean(dismissedBy[user.id]) : false;
  const shouldShow = Boolean(user && announcement && !isDismissed);

  const heartCount = announcement ? Object.keys(heartedBy).length : 0;
  const hasHeart = user ? Boolean(heartedBy[user.id]) : false;

  return (
    <AnimatePresence>
      {shouldShow && announcement && user && (
        <motion.aside
          key="global-announcement"
          className="announcement-prompt"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25 }}
        >
          <button
            type="button"
            className="announcement-prompt__close"
            onClick={() => dismissForUser(user.id)}
            aria-label="Dismiss announcement"
          >
            <X size={16} />
          </button>
          <div className="announcement-prompt__body">
            <h3>Latest from the devs</h3>
            <p>{announcement.message}</p>
          </div>
          <div className="announcement-prompt__footer">
            <span>{new Date(announcement.createdAt).toLocaleString()}</span>
            {announcement.allowHearts && (
              <button
                type="button"
                className={`announcement-prompt__heart ${hasHeart ? "is-active" : ""}`}
                onClick={() => toggleHeart(user.id)}
                aria-label={hasHeart ? "Remove heart" : "Send heart"}
              >
                <Heart size={16} fill={hasHeart ? "currentColor" : "none"} />
                <span>{heartCount}</span>
              </button>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
