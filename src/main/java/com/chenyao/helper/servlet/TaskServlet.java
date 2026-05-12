package com.chenyao.helper.servlet;

import com.chenyao.helper.model.Task;
import javax.servlet.*;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.*;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import java.util.*;
import java.io.InputStream;
import java.util.Properties;

@WebServlet("/tasks")
public class TaskServlet extends HttpServlet {
    
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
    
    // GET -> 返回任务列表
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json;charset=UTF-8");
        String action = req.getParameter("action");
        
        try (Connection conn = getConnection();
             PrintWriter out = resp.getWriter()) {
            
            // 获取统计信息
            if ("stats".equals(action)) {
                String sql = "SELECT COUNT(*) as total, SUM(time) as total_time, " +
                           "SUM(CASE WHEN completed = true THEN time ELSE 0 END) as completed_time " +
                           "FROM tasks";
                PreparedStatement ps = conn.prepareStatement(sql);
                ResultSet rs = ps.executeQuery();
                
                if (rs.next()) {
                    Map<String, Object> stats = new HashMap<>();
                    stats.put("total", rs.getInt("total"));
                    stats.put("totalTime", rs.getInt("total_time"));
                    stats.put("completedTime", rs.getInt("completed_time"));
                    out.print(new com.google.gson.Gson().toJson(stats));
                }
                return;
            }
            
            // 获取任务列表
            List<Task> tasks = new ArrayList<>();
            String filter = req.getParameter("filter");
            String sql;
            
            if ("completed".equals(filter)) {
                sql = "SELECT * FROM tasks WHERE completed = true ORDER BY priority DESC";
            } else if ("all".equals(filter)) {
                sql = "SELECT * FROM tasks ORDER BY priority DESC, created_at ASC";
            } else {
                sql = "SELECT * FROM tasks WHERE completed = false ORDER BY priority DESC, created_at ASC";
            }
            
            PreparedStatement ps = conn.prepareStatement(sql);
            ResultSet rs = ps.executeQuery();
            
            while (rs.next()) {
                Task t = new Task();
                t.setId(rs.getInt("id"));
                t.setName(rs.getString("name"));
                t.setTime(rs.getInt("time"));
                t.setPriority(rs.getInt("priority"));
                t.setCompleted(rs.getBoolean("completed"));
                t.setCategory(rs.getString("category"));
                t.setCreatedAt(rs.getString("created_at"));
                tasks.add(t);
            }
            
            out.print(new com.google.gson.Gson().toJson(tasks));
            
        } catch (Exception e) {
            e.printStackTrace();
            resp.sendError(500, "Database error: " + e.getMessage());
        }
    }
    
    // POST -> 添加任务
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        req.setCharacterEncoding("UTF-8");
        String action = req.getParameter("action");
        
        try (Connection conn = getConnection()) {
            // 编辑任务
            if ("edit".equals(action)) {
                int taskId = Integer.parseInt(req.getParameter("taskId"));
                String newName = req.getParameter("taskName");
                int newTime = Integer.parseInt(req.getParameter("time"));
                
                String sql = "UPDATE tasks SET name=?, time=? WHERE id=?";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setString(1, newName);
                ps.setInt(2, newTime);
                ps.setInt(3, taskId);
                ps.executeUpdate();
                
                resp.setStatus(HttpServletResponse.SC_OK);
                return;
            }
            
            // 添加任务
            String taskName = req.getParameter("taskName");
            String category = req.getParameter("category");
            if (category == null || category.isEmpty()) {
                category = detectCategory(taskName);
            }
            
            // Planner Agent: 智能拆解
            List<String[]> subtasksList = new ArrayList<>();
            subtasksList.add(splitTask(taskName));
            
            // 如果主任务匹配模板，添加子任务
            String[] template = getTemplate(taskName);
            if (template != null) {
                subtasksList.add(template);
            }
            
            Random rand = new Random();
            
            for (String[] subtasks : subtasksList) {
                String sql = "INSERT INTO tasks(name, time, priority, category) VALUES(?,?,?,?)";
                PreparedStatement ps = conn.prepareStatement(sql);
                
                for (String sub : subtasks) {
                    ps.setString(1, sub);
                    ps.setInt(2, rand.nextInt(60) + 15); // Time Agent: 15-75分钟
                    ps.setInt(3, calculatePriority(taskName)); // Priority Agent
                    ps.setString(4, category);
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            
        } catch (Exception e) {
            e.printStackTrace();
            resp.sendError(500, "Failed to add task: " + e.getMessage());
            return;
        }
        
        resp.setStatus(HttpServletResponse.SC_OK);
    }
    
    // DELETE -> 删除任务
    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String taskId = req.getParameter("taskId");
        
        try (Connection conn = getConnection()) {
            if ("clearCompleted".equals(taskId)) {
                String sql = "DELETE FROM tasks WHERE completed = true";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.executeUpdate();
            } else {
                String sql = "DELETE FROM tasks WHERE id = ?";
                PreparedStatement ps = conn.prepareStatement(sql);
                ps.setInt(1, Integer.parseInt(taskId));
                ps.executeUpdate();
            }
            resp.setStatus(HttpServletResponse.SC_OK);
        } catch (Exception e) {
            e.printStackTrace();
            resp.sendError(500, "Failed to delete task: " + e.getMessage());
        }
    }
    
    // Priority Agent: 根据关键词计算优先级
    private int calculatePriority(String taskName) {
        String[] urgentKeywords = {"考试", "作业", "论文", "报告", "答辩", "deadline", "截止"};
        String[] importantKeywords = {"复习", "学习", "练习", "课程", "实验"};
        
        for (String keyword : urgentKeywords) {
            if (taskName.contains(keyword)) return 3; // 高优先级
        }
        for (String keyword : importantKeywords) {
            if (taskName.contains(keyword)) return 2; // 中优先级
        }
        return 1; // 低优先级
    }
    
    // 自动识别任务分类
    private String detectCategory(String taskName) {
        if (taskName.contains("英语") || taskName.contains("论文") || taskName.contains("翻译")) {
            return "english";
        } else if (taskName.contains("数学") || taskName.contains("高数") || taskName.contains("线代")) {
            return "math";
        } else if (taskName.contains("编程") || taskName.contains("代码") || taskName.contains("课设")) {
            return "programming";
        } else if (taskName.contains("实验")) {
            return "lab";
        }
        return "other";
    }
    
    // Planner Agent: 任务拆解模板
    private String[] getTemplate(String taskName) {
        Map<String, String[]> templates = new HashMap<>();
        templates.put("数据库课设", new String[]{"需求分析", "数据库设计", "后端开发", "前端开发", "系统测试", "撰写报告"});
        templates.put("英语论文", new String[]{"查阅文献", "写大纲", "写初稿", "修改语法", "格式排版", "提交"});
        templates.put("操作系统复习", new String[]{"进程管理", "内存管理", "文件系统", "做真题", "整理笔记"});
        templates.put("Java项目", new String[]{"需求分析", "设计UML", "编写代码", "单元测试", "集成测试", "部署上线"});
        
        for (Map.Entry<String, String[]> entry : templates.entrySet()) {
            if (taskName.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }
    
    // 简单拆解：按标点符号分割
    private String[] splitTask(String taskName) {
        if (taskName.contains("、") || taskName.contains("，") || taskName.contains(",")) {
            return taskName.split("[、，,]");
        }
        return new String[]{taskName};
    }
}
