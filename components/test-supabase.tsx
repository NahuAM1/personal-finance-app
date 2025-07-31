"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"

export function TestSupabase() {
  const { user } = useAuth()
  const [result, setResult] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const testConnection = async () => {
    setLoading(true)
    setResult("")

    try {
      // Test 1: Check auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        setResult(`Session Error: ${sessionError.message}`)
        setLoading(false)
        return
      }

      if (!session) {
        setResult("No active session found")
        setLoading(false)
        return
      }

      // Test 2: Try to fetch transactions
      const { data: transactions, error: fetchError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", session.user.id)
        .limit(1)

      if (fetchError) {
        setResult(`Fetch Error: ${fetchError.message}\nCode: ${fetchError.code}\nDetails: ${fetchError.details}`)
        setLoading(false)
        return
      }

      // Test 3: Try to insert a test transaction
      const testTransaction = {
        user_id: session.user.id,
        type: "expense",
        amount: 0.01,
        category: "Test",
        description: "Test transaction - can be deleted",
        date: new Date().toISOString().split("T")[0],
      }

      const { data: insertData, error: insertError } = await supabase
        .from("transactions")
        .insert([testTransaction])
        .select()
        .single()

      if (insertError) {
        setResult(`Insert Error: ${insertError.message}\nCode: ${insertError.code}\nDetails: ${insertError.details}`)
        setLoading(false)
        return
      }

      // Test 4: Delete the test transaction
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", insertData.id)

      if (deleteError) {
        setResult(`Delete Error: ${deleteError.message}\nCode: ${deleteError.code}\nDetails: ${deleteError.details}`)
        setLoading(false)
        return
      }

      setResult(`✅ All tests passed!\nSession User: ${session.user.email}\nUser ID: ${session.user.id}\nTransactions found: ${transactions?.length || 0}`)
    } catch (error) {
      setResult(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
    }

    setLoading(false)
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h3 className="font-semibold">Supabase Connection Test</h3>
      <Button onClick={testConnection} disabled={loading}>
        {loading ? "Testing..." : "Run Test"}
      </Button>
      {result && (
        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm whitespace-pre-wrap">
          {result}
        </pre>
      )}
      <div className="text-sm text-gray-600">
        Current user from hook: {user?.email || "Not logged in"}
      </div>
    </div>
  )
}