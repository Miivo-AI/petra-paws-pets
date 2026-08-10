"use client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/**
 * Single app-wide toast host, mounted once in the root layout. Any
 * component can call toast.success/toast.error (react-toastify) without
 * rendering its own ToastContainer.
 */
export default function Toaster() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      newestOnTop
      closeOnClick
      pauseOnHover
      theme="light"
      toastClassName="!font-sans"
    />
  );
}
