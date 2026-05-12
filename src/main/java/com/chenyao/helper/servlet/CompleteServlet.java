package com.chenyao.helper.servlet;

import javax.servlet.*;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import java.io.IOException;
import java.sql.*;
import java.io.InputStream;
import java.util.Properties;

@WebServlet("/complete")
public class CompleteServlet extends HttpServlet {
    
    private String dbUrl;
    private String dbUser;
    private String dbPassword;

    @Override
    public void init() throws ServletException {
        try (InputStream input = getClass().getClassLoader().getResourceAsStream("db.properties")) {
            Properties prop = new Properties();
            if (input == null) {
                this.dbUrl = "jdbc:mysql://localhost:3306/procrastination_helper?useSSL=false&serverTimezone=UTC";
                this.dbUser = "root";
                this.dbPassword = "123456";
                return;
            }
            prop.load(input);
            this.dbUrl = prop.getProperty("db.url");
            this.dbUser = prop.getProperty("db.user");
            this.dbPassword = prop.getProperty("db.password");
        } catch (Exception e) {
            throw new ServletException("Database configuration error", e);
        }
    }
    
    private Connection getConnection() throws Exception {
        Class.forName("com.mysql.cj.jdbc.Driver");
        return DriverManager.getConnection(dbUrl, dbUser, dbPassword);
    }
    
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        int taskId = Integer.parseInt(req.getParameter("taskId"));
        
        try (Connection conn = getConnection()) {
            String sql = "UPDATE tasks SET completed=true WHERE id=?";
            PreparedStatement ps = conn.prepareStatement(sql);
            ps.setInt(1, taskId);
            ps.executeUpdate();
            resp.setStatus(HttpServletResponse.SC_OK);
        } catch (Exception e) {
            e.printStackTrace();
            resp.sendError(500, "Failed to complete task: " + e.getMessage());
        }
    }
}
