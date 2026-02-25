import React from "react";

const Notification = ({ message, type = "info", detail, onClose }) => {
    if (!message) return null;

    const styles = {
        error: { bg: "#fde8e8", text: "#c53030", border: "#fbd5d5" },
        warning: { bg: "#feebc8", text: "#c05621", border: "#fbd38d" },
        success: { bg: "#c6f6d5", text: "#276749", border: "#9ae6b4" },
        info: { bg: "#ebf8ff", text: "#2b6cb0", border: "#bee3f8" }
    };

    const currentStyle = styles[type] || styles.info;

    return (
        <div style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 1000,
            backgroundColor: currentStyle.bg,
            color: currentStyle.text,
            border: `1px solid ${currentStyle.border}`,
            padding: "16px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            maxWidth: "350px",
            animation: "slideIn 0.3s ease-out"
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: detail ? "8px" : "0" }}>
                <strong style={{ fontSize: "0.95rem" }}>{message}</strong>
                <button
                    onClick={onClose}
                    style={{
                        background: "none",
                        border: "none",
                        color: "currentColor",
                        cursor: "pointer",
                        fontSize: "1.2rem",
                        lineHeight: "1",
                        marginLeft: "12px"
                    }}
                >
                    ×
                </button>
            </div>
            {detail && (
                <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.9 }}>
                    {detail}
                </p>
            )}
        </div>
    );
};

export default Notification;
