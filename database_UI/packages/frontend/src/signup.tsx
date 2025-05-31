
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as api from './api';

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const isLoggedIn = await api.checkLoginStatus();
        if (isLoggedIn.loggedIn) {
          console.log("User already logged in, redirecting to Dashboard.");
          navigate("/Dashboard");
        } else {
          console.log("User not logged in.");
        }
      } catch (error) {
        console.error("Error checking login status on signup page:", error);
      }
    };
    checkStatus();
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => { 
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => { 
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);    

    try {
      await api.signupUser(formData);
      console.log("Signup successful, navigating to Dashboard.");
      navigate("/Login");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message || "Signup failed. Please check your input.");
      } else {
        setErrorMessage("An unexpected error occurred during signup.");
      }
      console.error("Signup failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

   const buttonStyle: React.CSSProperties = {
    backgroundColor: "#555",
    color: "#fff",
    padding: "10px 15px",
    borderRadius: "4px",
    border: "none",
    cursor: isLoading ? 'not-allowed' : 'pointer',
    fontSize: "16px",
    marginTop: "10px",
    transition: "background-color 0.2s ease-in-out, opacity 0.2s ease-in-out",
    opacity: isLoading ? 0.7 : 1, 
  };

  const buttonHoverStyle: React.CSSProperties = {
    backgroundColor: "#333",
  };

  return (
    <div
      style={{
        backgroundColor: "#f0f0f0",
        padding: "20px",
        borderRadius: "8px",
        width: "300px",
        margin: "40px auto", 
        fontFamily: "Arial, sans-serif",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)", 
      }}
    >
      <h2 style={{ color: "#333", textAlign: "center", marginBottom: "20px" }}> {/* Matched login margin */}
        Sign Up
      </h2>
      {errorMessage && (
        <p style={{ color: "red", marginBottom: "15px", textAlign: "center", fontSize: '0.9em' }}> {/* Matched login style */}
          {errorMessage}
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}> {/* Matched login gap */}
        {/* Username Input */}
        <div style={{ display: "flex", flexDirection: "column"}}>
          <label htmlFor="username" style={{ color: "#555", marginBottom: "5px", fontWeight: 'bold' }}> {/* Matched login style */}
            Username:
          </label>
          <input
            type="text"
            id="username"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Choose a username" 
            required 
            style={{
              padding: "10px", 
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              fontSize: '1em', 
            }}
            disabled={isLoading} 
          />
        </div>
        {/* Email Input */}
        <div style={{ display: "flex", flexDirection: "column"}}>
          <label htmlFor="email" style={{ color: "#555", marginBottom: "5px", fontWeight: 'bold' }}> {/* Matched login style */}
            Email:
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required 
            style={{
              padding: "10px", 
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              fontSize: '1em', 
            }}
            disabled={isLoading} 
          />
        </div>
        {/* Password Input */}
        <div style={{ display: "flex", flexDirection: "column"}}>
          <label htmlFor="password" style={{ color: "#555", marginBottom: "5px", fontWeight: 'bold' }}> {/* Matched login style */}
            Password:
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Create a password" 
            required 
            style={{
              padding: "10px", 
              borderRadius: "4px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              color: "#333",
              fontSize: '1em', 
            }}
            disabled={isLoading} 
          />
        </div>
        {/* Submit Button */}
        <button
          type="submit"
          style={buttonStyle}
          onMouseOver={(e) => {
            if (!isLoading) {
              (e.target as HTMLButtonElement).style.backgroundColor = buttonHoverStyle.backgroundColor;
            }
          }}
          onMouseOut={(e) => {
             (e.target as HTMLButtonElement).style.backgroundColor = buttonStyle.backgroundColor;
          }}
          disabled={isLoading} 
        >
          {/* --- Change button text when loading --- */}
          {isLoading ? "Signing up..." : "Sign Up"}
        </button>
      </form>
      {/* Link to Login */}
      <p style={{ marginTop: "20px", textAlign: "center", color: "#555", fontSize: "0.9em" }}> {/* Matched login style */}
        Already have an account? <Link to="/login" style={{ color: "#007bff", textDecoration: 'none' }}>Login here</Link> {/* Matched login style */}
      </p>
    </div>
  );
};

export default Signup;